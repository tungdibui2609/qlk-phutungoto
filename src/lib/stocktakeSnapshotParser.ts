import ExcelJS from 'exceljs'
import { normalizeUnit } from './warehouseExcelExport'

/**
 * Đọc lại 2 file Excel do trang In sơ đồ kho sinh ra
 * (src/lib/warehouseExcelExport.ts) để làm mốc đối chiếu kiểm kê.
 */

export type StocktakeFormat = 'table' | 'grid' | 'lot'

export const FORMAT_LABEL: Record<StocktakeFormat, string> = {
    table: 'dạng Bảng',
    grid: 'dạng Lưới',
    lot: 'tồn theo LOT',
}

export interface StocktakeRow {
    warehouse: string
    rowName: string
    binName: string
    levelName: string
    positionCode: string
    lotCode: string
    sku: string
    productName: string
    unit: string
    quantity: number
    pallets: number | null
    /** Chỉ file LOT có cột "Quy đổi (Kg)" trên sheet Tổng hợp. */
    kg?: number
    /** Dòng trên sheet gốc sinh ra dòng này — dùng để tô đỏ lại đúng chỗ trong file báo cáo. */
    srcRow: number
    /** Cột trên sheet gốc; null với file Bảng và file LOT (cả một dòng = một mục cần đối chiếu). */
    srcCol: number | null
    /** Chỉ file LOT: khối "DANH MỤC:" đang bao quanh dòng này. */
    category: string
}

export interface ParsedStocktake {
    format: StocktakeFormat
    fileName: string
    systemName: string
    exportDate: string
    zoneName: string
    rows: StocktakeRow[]
    parsedTotal: number
    declaredTotal: number | null
    warnings: string[]
    /** Sheet sơ đồ gốc trong file, giữ lại để chép nguyên bản sang file báo cáo đối chiếu. */
    sourceSheet: ExcelJS.Worksheet
}

export interface StocktakeFileLike {
    name: string
    arrayBuffer(): Promise<ArrayBuffer>
}

/** Bỏ dấu tiếng Việt + gộp khoảng trắng để so khớp tiêu đề cột một cách chịu lỗi. */
export function foldText(value: string): string {
    return (value || '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        // Đ/đ là chữ cái La-tinh có dấu, không tách được thành D + dấu qua NFD
        .replace(/đ/g, 'd')
}

function cellText(cell: ExcelJS.Cell): string {
    const value = cell?.value
    if (value === null || value === undefined) return ''
    if (value instanceof Date) return value.toLocaleDateString('vi-VN')
    if (typeof value === 'object') {
        const anyValue = value as any
        if (Array.isArray(anyValue.richText)) {
            return anyValue.richText.map((part: any) => part?.text ?? '').join('')
        }
        if (typeof anyValue.text === 'string') return anyValue.text
        if ('result' in anyValue) return anyValue.result === null || anyValue.result === undefined ? '' : String(anyValue.result)
        if (typeof anyValue.hyperlink === 'string') return anyValue.hyperlink
        return ''
    }
    return String(value)
}

function isRichTextCell(cell: ExcelJS.Cell): boolean {
    const value = cell?.value
    return typeof value === 'object' && value !== null && Array.isArray((value as any).richText)
}

function cellNumber(cell: ExcelJS.Cell): number | null {
    const value = cell?.value
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    return parseQuantityText(cellText(cell))
}

/** Chấp nhận cả cách viết số kiểu VN ("1.234,5") lẫn kiểu file gốc ("1234.5"). */
export function parseQuantityText(raw: string): number | null {
    const cleaned = (raw || '').replace(/[^\d.,-]/g, '')
    if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === ',') return null
    const hasComma = cleaned.includes(',')
    const hasDot = cleaned.includes('.')
    let normalized = cleaned
    if (hasComma && hasDot) {
        normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
            ? cleaned.replace(/\./g, '').replace(',', '.')
            : cleaned.replace(/,/g, '')
    } else if (hasComma) {
        normalized = /^\d{1,3}(,\d{3})+$/.test(cleaned) ? cleaned.replace(/,/g, '') : cleaned.replace(',', '.')
    }
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
}

function readMetaFromLine(line: string): { systemName: string; zoneName: string; exportDate: string } {
    const meta = { systemName: '', zoneName: '', exportDate: '' }
    ;(line || '').split('|').forEach(chunk => {
        const part = chunk.trim()
        const sys = part.match(/^Hệ\s*thống\s*:\s*(.*)$/i) || part.match(/^Kho\s*:\s*(.*)$/i)
        if (sys) meta.systemName = sys[1].trim()
        const zone = part.match(/^Khu\s*vực\s*:\s*(.*)$/i)
        if (zone) meta.zoneName = zone[1].trim()
        const date = part.match(/Ngày\s*xuất\s*:\s*(\S+)/i)
        if (date) meta.exportDate = date[1].trim()
    })
    return meta
}

// ============================================================================
// FILE "EXCEL (BẢNG)" — sheet 'Sơ đồ kho', một dòng = (vị trí × dòng sản phẩm)
// ============================================================================

const TABLE_COLUMN_ALIASES: Record<string, string[]> = {
    warehouse: ['kho'],
    rowName: ['day'],
    binName: ['o / khu vuc', 'o', 'khu vuc'],
    levelName: ['tang'],
    positionCode: ['ma vi tri'],
    lotCode: ['so lo (lot)', 'so lo', 'ma lo', 'lo'],
    sku: ['ma sp (sku)', 'ma sp', 'ma san pham'],
    productName: ['san pham', 'ten san pham'],
    unit: ['dvt', 'don vi', 'don vi tinh'],
    quantity: ['so luong'],
}

function locateTableHeader(worksheet: ExcelJS.Worksheet): { rowNumber: number; columns: Record<string, number> } | null {
    const limit = Math.min(worksheet.rowCount, 20)
    for (let r = 1; r <= limit; r++) {
        const row = worksheet.getRow(r)
        const columns: Record<string, number> = {}
        let foundPositionCode = false
        for (let c = 1; c <= row.cellCount; c++) {
            const header = foldText(cellText(row.getCell(c)))
            if (!header) continue
            for (const [field, aliases] of Object.entries(TABLE_COLUMN_ALIASES)) {
                if (columns[field] === undefined && aliases.includes(header)) {
                    columns[field] = c
                    if (field === 'positionCode') foundPositionCode = true
                }
            }
        }
        if (foundPositionCode && columns.quantity !== undefined) return { rowNumber: r, columns }
    }
    return null
}

function parseTableWorksheet(worksheet: ExcelJS.Worksheet, fileName: string): ParsedStocktake {
    const warnings: string[] = []
    const header = locateTableHeader(worksheet)
    if (!header) throw new Error(`Không tìm thấy bảng sơ đồ kho trong sheet "${worksheet.name}" của file ${fileName}.`)

    const { rowNumber, columns } = header
    const pick = (row: ExcelJS.Row, field: string): string => {
        const idx = columns[field]
        return idx ? cellText(row.getCell(idx)).trim() : ''
    }

    let meta = { systemName: '', zoneName: '', exportDate: '' }
    for (let r = 1; r < rowNumber; r++) {
        const line = cellText(worksheet.getRow(r).getCell(1))
        const candidate = readMetaFromLine(line)
        if (candidate.systemName) meta.systemName = candidate.systemName
        if (candidate.zoneName) meta.zoneName = candidate.zoneName
        if (candidate.exportDate) meta.exportDate = candidate.exportDate
    }

    const rows: StocktakeRow[] = []
    let parsedTotal = 0
    let declaredTotal: number | null = null

    for (let r = rowNumber + 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r)
        const sttText = foldText(cellText(row.getCell(1)))
        if (sttText === 'tong cong') {
            declaredTotal = cellNumber(row.getCell(columns.quantity))
            break
        }

        const positionCode = pick(row, 'positionCode')
        if (!positionCode) continue

        const quantity = cellNumber(row.getCell(columns.quantity)) ?? 0
        const unit = normalizeUnit(pick(row, 'unit'))
        const productName = pick(row, 'productName')
        const sku = pick(row, 'sku')
        const lotCode = pick(row, 'lotCode')
        const isEmptyPosition = !lotCode || foldText(lotCode) === '(trong)'

        rows.push({
            warehouse: pick(row, 'warehouse'),
            rowName: pick(row, 'rowName'),
            binName: pick(row, 'binName'),
            levelName: pick(row, 'levelName'),
            positionCode,
            lotCode: isEmptyPosition ? '' : lotCode,
            sku,
            productName: isEmptyPosition ? '' : productName,
            unit: isEmptyPosition ? '' : unit,
            quantity: isEmptyPosition ? 0 : quantity,
            pallets: null,
            srcRow: r,
            srcCol: null,
            category: '',
        })
        parsedTotal += isEmptyPosition ? 0 : quantity
    }

    if (!rows.length) warnings.push('File dạng Bảng không có dòng dữ liệu nào (có thể do sơ đồ lọc ra kết quả trống).')

    return {
        format: 'table',
        fileName,
        ...meta,
        rows,
        parsedTotal,
        declaredTotal,
        warnings,
        sourceSheet: worksheet,
    }
}

// ============================================================================
// FILE "EXCEL (LƯỚI)" — sheet 'Sơ đồ mặt bằng', ô = richText nhiều dòng
//   "• [MÃ BATCH] Tên sản phẩm : 12 Thùng (20kg) (3 PL)"
// ============================================================================

const GRID_ITEM_REGEX = /^(?:[•·\-]\s*)?(?:\[([^\]]*)\]\s*)?(.*?)\s*:\s*([\d.,]+)\s+(.*?)(?:\s+\((\d+)\s*PL\))?$/

const BANNER_PREFIXES = ['mau xuat file', 'day : xep', 'o : xep', 'khu vuc:']

function isYellowCell(cell: ExcelJS.Cell): boolean {
    const fill = cell?.fill as any
    if (!fill || fill.type !== 'pattern') return false
    const argb = String(fill?.fgColor?.argb ?? '')
    return argb.endsWith('FFFF00')
}

function parseGridCellText(text: string): Array<{ productName: string; unit: string; quantity: number; pallets: number | null }> {
    const items: Array<{ productName: string; unit: string; quantity: number; pallets: number | null }> = []
    let segments = (text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    // Ô trống chỉ có dòng phân cách "------"
    segments = segments.filter(s => !/^[-—–]{5,}$/.test(s))
    // Hàng Sảnh gom nhiều sản phẩm trong một ô, phân tách bằng "    |    "
    if (segments.length <= 1 && (text || '').includes('|')) {
        segments = (text || '').split('|').map(s => s.trim()).filter(Boolean)
    }

    segments.forEach(segment => {
        const match = segment.match(GRID_ITEM_REGEX)
        if (!match) return
        const [, , name, qtyText, unitText, palletsText] = match
        const quantity = parseQuantityText(qtyText)
        if (quantity === null) return
        items.push({
            productName: (name || '').trim(),
            unit: normalizeUnit((unitText || '').trim()),
            quantity,
            pallets: palletsText ? Number(palletsText) : null,
        })
    })
    return items
}

function sumGridGrandTotal(worksheet: ExcelJS.Worksheet): number | null {
    const header = locateTableHeader(worksheet)
    const columns = header?.columns
    let total = 0
    let counted = 0
    const quantityCol = columns?.quantity ?? 5
    for (let r = (header?.rowNumber ?? 1) + 1; r <= worksheet.rowCount; r++) {
        const qty = cellNumber(worksheet.getRow(r).getCell(quantityCol))
        if (qty === null) continue
        total += qty
        counted++
    }
    return counted > 0 ? total : null
}

function parseGridWorkbook(workbook: ExcelJS.Workbook, fileName: string): ParsedStocktake {
    const warnings: string[] = []
    const worksheet = workbook.getWorksheet('Sơ đồ mặt bằng') || workbook.worksheets[0]
    if (!worksheet) throw new Error(`File ${fileName} không có trang tính nào.`)

    let meta = { systemName: '', zoneName: '', exportDate: '' }
    for (let r = 1; r <= Math.min(4, worksheet.rowCount); r++) {
        const candidate = readMetaFromLine(cellText(worksheet.getRow(r).getCell(1)))
        if (candidate.systemName) meta = candidate
    }

    const rows: StocktakeRow[] = []
    let parsedTotal = 0
    let currentParent = ''
    let currentRowName = ''
    let binByColumn: Record<number, string> = {}
    const maxColumn = worksheet.columnCount

    for (let r = 5; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r)
        const firstCellText = cellText(row.getCell(1)).trim()
        const foldedFirst = foldText(firstCellText)

        if (BANNER_PREFIXES.some(prefix => foldedFirst.startsWith(prefix))) {
            if (foldedFirst.startsWith('khu vuc:')) {
                currentParent = firstCellText.replace(/^KHU\s*VỰC\s*:/i, '').trim()
                currentRowName = ''
                binByColumn = {}
            }
            continue
        }

        if (isYellowCell(row.getCell(1))) {
            // Hàng tên Dãy (kèm tên Ô ở các cột) hoặc hàng Sảnh (dữ liệu nằm ngay cột 2)
            currentRowName = firstCellText
            binByColumn = {}
            for (let c = 2; c <= maxColumn; c++) {
                const cell = row.getCell(c)
                if (isRichTextCell(cell)) continue
                const binName = cellText(cell).trim()
                if (binName) binByColumn[c] = binName
            }
            const lobbyText = cellText(row.getCell(2))
            if (lobbyText && !binByColumn[2]) {
                parseGridCellText(lobbyText).forEach(item => {
                    rows.push({
                        warehouse: currentParent,
                        rowName: currentRowName,
                        binName: '',
                        levelName: '',
                        positionCode: '',
                        lotCode: '',
                        sku: item.productName,
                        productName: item.productName,
                        unit: item.unit,
                        quantity: item.quantity,
                        pallets: item.pallets,
                        srcRow: r,
                        srcCol: 2,
                        category: '',
                    })
                    parsedTotal += item.quantity
                })
            }
            continue
        }

        // Hàng Tầng: cột 1 = tên tầng (rỗng khi tầng là 'DỮ LIỆU')
        const levelName = foldedFirst === 'du lieu' ? '' : firstCellText
        for (let c = 2; c <= maxColumn; c++) {
            const cell = row.getCell(c)
            const text = cellText(cell)
            if (!text.trim()) continue
            parseGridCellText(text).forEach(item => {
                rows.push({
                    warehouse: currentParent,
                    rowName: currentRowName,
                    binName: binByColumn[c] || '',
                    levelName,
                    positionCode: '',
                    lotCode: '',
                    sku: item.productName,
                    productName: item.productName,
                    unit: item.unit,
                    quantity: item.quantity,
                    pallets: item.pallets,
                    srcRow: r,
                    srcCol: c,
                    category: '',
                })
                parsedTotal += item.quantity
            })
        }
    }

    let declaredTotal: number | null = null
    const summarySheet = workbook.getWorksheet('Thống kê Tổng hợp')
    if (summarySheet) declaredTotal = sumGridGrandTotal(summarySheet)

    if (declaredTotal !== null && Math.abs(declaredTotal - parsedTotal) > 0.001) {
        warnings.push(
            `Ô sơ đồ lưới chỉ đọc được ${parsedTotal.toLocaleString('vi-VN')} / ${declaredTotal.toLocaleString('vi-VN')} ở sheet "Thống kê Tổng hợp". ` +
            'Một khu vực không có ô/tầng (hoặc đang gộp tầng) không hiển thị trong sơ đồ nên không đối chiếu được tới cấp ô.'
        )
    }
    if (!rows.length) warnings.push('File dạng Lưới không đọc được ô dữ liệu nào (sơ đồ trống hoặc cấu trúc hàng/cột lạ).')

    return { format: 'grid', fileName, ...meta, rows, parsedTotal, declaredTotal, warnings, sourceSheet: worksheet }
}

// ============================================================================
// FILE "TỒN KHO THEO LOT" — sheet 'Tổng hợp' của exportInventoryReportToExcel
//   Sheet này đã gom sẵn: mỗi sản phẩm × ĐVT đúng một dòng, không có dòng con
//   (tháng nhập / LSX / mã phụ) — hợp với nhu cầu đối chiếu tổng tồn 2 mốc.
//   Vẫn bỏ qua các banner 'DANH MỤC:' vì chúng không phải dòng sản phẩm.
// ============================================================================

/** Sheet 'Tổng hợp' chỉ có trong file tồn theo LOT; 'Theo mã phụ'/'Theo danh mục' không có sheet này. */
const LOT_SUMMARY_SHEET = 'tong hop'

const LOT_COLUMN_ALIASES: Record<string, string[]> = {
    stt: ['stt'],
    sku: ['ma sp', 'ma sp (sku)', 'ma san pham'],
    productName: ['ten san pham', 'san pham'],
    unit: ['dvt', 'don vi', 'don vi tinh'],
    quantity: ['so luong'],
    kg: ['quy doi', 'quy doi (kg)', 'quy doi kg'],
}

function locateLotHeader(worksheet: ExcelJS.Worksheet): { rowNumber: number; columns: Record<string, number> } | null {
    if (foldText(worksheet.name).trim() !== LOT_SUMMARY_SHEET) return null
    const limit = Math.min(worksheet.rowCount, 25)
    for (let r = 1; r <= limit; r++) {
        const row = worksheet.getRow(r)
        const columns: Record<string, number> = {}
        for (let c = 1; c <= row.cellCount; c++) {
            const header = foldText(cellText(row.getCell(c)))
            if (!header) continue
            for (const [field, aliases] of Object.entries(LOT_COLUMN_ALIASES)) {
                if (columns[field] === undefined && aliases.includes(header)) columns[field] = c
            }
        }
        const hasProduct = columns.sku !== undefined || columns.productName !== undefined
        if (columns.stt !== undefined && columns.quantity !== undefined && hasProduct) return { rowNumber: r, columns }
    }
    return null
}

function parseLotWorksheet(worksheet: ExcelJS.Worksheet, fileName: string): ParsedStocktake {
    const warnings: string[] = []
    const header = locateLotHeader(worksheet)
    if (!header) throw new Error(`Không tìm thấy bảng tồn kho trong sheet "${worksheet.name}" của file ${fileName}.`)
    const { rowNumber, columns } = header

    const pick = (row: ExcelJS.Row, field: string): string => {
        const idx = columns[field]
        return idx ? cellText(row.getCell(idx)).trim() : ''
    }

    let zoneName = ''
    let exportDate = ''
    for (let r = 1; r < rowNumber; r++) {
        const line = cellText(worksheet.getRow(r).getCell(1)).trim()
        const folded = foldText(line)
        if (folded.startsWith('kho:')) zoneName = line.replace(/^Kho\s*:\s*/i, '').trim()
        if (/^(tu ngay|tinh den ngay)/i.test(folded)) exportDate = line
    }

    const rows: StocktakeRow[] = []
    let parsedTotal = 0
    let category = ''

    for (let r = rowNumber + 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r)
        // Banner 'DANH MỤC:' (merge A:D) không phải dòng sản phẩm
        const firstText = cellText(row.getCell(1)).trim()
        if (foldText(firstText).startsWith('danh muc:')) {
            category = firstText.replace(/^DANH\s*MỤC\s*:\s*/i, '').trim()
            continue
        }
        // Chỉ lấy dòng có STT là số nguyên dương — an toàn cho cả file cũ còn dòng con
        const stt = cellNumber(row.getCell(columns.stt))
        if (stt === null || !Number.isInteger(stt) || stt <= 0) continue

        const sku = pick(row, 'sku')
        const productName = pick(row, 'productName')
        if (!sku && !productName) continue

        const quantity = cellNumber(row.getCell(columns.quantity)) ?? 0
        const kg = columns.kg ? cellNumber(row.getCell(columns.kg)) ?? 0 : 0
        rows.push({
            warehouse: '',
            rowName: '',
            binName: '',
            levelName: '',
            positionCode: '',
            lotCode: '',
            sku,
            productName,
            unit: normalizeUnit(pick(row, 'unit')),
            quantity,
            kg,
            pallets: null,
            srcRow: r,
            srcCol: null,
            category,
        })
        parsedTotal += quantity
    }

    if (!rows.length) warnings.push('File tồn theo LOT không đọc được dòng sản phẩm nào (báo cáo trống hoặc không có cột STT).')

    return {
        format: 'lot',
        fileName,
        systemName: '',
        exportDate,
        zoneName,
        rows,
        parsedTotal,
        declaredTotal: null,
        warnings,
        sourceSheet: worksheet,
    }
}

/**
 * Nhận diện và đọc một file Excel sơ đồ kho.
 * File "Bảng" có cột 'Mã vị trí'; file "Lưới" có sheet 'Sơ đồ mặt bằng';
 * file "Tồn theo LOT" là sheet 'Tổng hợp' (STT + Mã SP + Số lượng) của báo cáo tồn kho.
 */
export async function parseStocktakeFile(file: StocktakeFileLike): Promise<ParsedStocktake> {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await file.arrayBuffer())

    const tableSheet = workbook.worksheets.find(ws => locateTableHeader(ws) !== null)
    if (tableSheet) return parseTableWorksheet(tableSheet, file.name)

    const gridSheet = workbook.worksheets.find(ws => {
        const limit = Math.min(ws.rowCount, 6)
        for (let r = 1; r <= limit; r++) {
            const folded = foldText(cellText(ws.getRow(r).getCell(1)))
            if (folded.startsWith('mau xuat file') || folded.startsWith('day : xep')) return true
        }
        return ws.name === 'Sơ đồ mặt bằng'
    })
    if (gridSheet) return parseGridWorkbook(workbook, file.name)

    const lotSheet = workbook.worksheets.find(ws => locateLotHeader(ws) !== null)
    if (lotSheet) return parseLotWorksheet(lotSheet, file.name)

    const sheetNames = workbook.worksheets.map(ws => `"${ws.name}"`).join(', ')
    throw new Error(`File ${file.name} không phải sơ đồ kho (Bảng/Lưới) hay báo cáo tồn theo LOT (cần sheet "Tổng hợp") xuất từ hệ thống. Các trang tính trong file: ${sheetNames}.`)
}
