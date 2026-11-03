import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { CompanyInfo } from '@/hooks/usePrintCompanyInfo'
import {
    StocktakeReconciliation,
    StocktakeDiffRow,
    buildRowKey,
    describeKind,
    describeLocation,
} from './stocktakeReconciliation'
import { FORMAT_LABEL, ParsedStocktake, StocktakeFormat } from './stocktakeSnapshotParser'

const HEADER_FILL = '4F46E5'
const DIFF_FILL = 'FFC7CE'
const THIN = { style: 'thin' as const }
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN }

/**
 * Chép nguyên bản sheet gốc của một file nguồn sang file báo cáo (giá trị, kiểu,
 * merge, bề rộng cột, chiều cao hàng) rồi tô đỏ đúng những chỗ lệch số lượng.
 * Dạng Bảng và tồn theo LOT tô cả dòng, dạng Lưới tô cả ô thuộc tầng có hàng lệch.
 */
function cloneSnapshotSheet(
    reportWorkbook: ExcelJS.Workbook,
    snapshot: ParsedStocktake,
    sheetName: string,
    diffKeys: Set<string>,
) {
    const source = snapshot.sourceSheet
    const target = reportWorkbook.addWorksheet(sheetName)
    const maxRow = source.rowCount
    const maxColumn = source.columnCount

    for (let c = 1; c <= maxColumn; c++) {
        const width = source.getColumn(c).width
        if (width) target.getColumn(c).width = width
    }

    // Ô cần tô: null = tô cả dòng (dạng Bảng), Set<cột> = tô từng ô (dạng Lưới)
    const paints = new Map<number, Set<number> | null>()
    snapshot.rows.forEach(row => {
        if (!diffKeys.has(buildRowKey(row, snapshot.format))) return
        if (row.srcCol === null) {
            paints.set(row.srcRow, null)
        } else {
            const cols = paints.get(row.srcRow) ?? new Set<number>()
            cols.add(row.srcCol)
            paints.set(row.srcRow, cols)
        }
    })

    for (let r = 1; r <= maxRow; r++) {
        const sourceRow = source.getRow(r)
        const targetRow = target.getRow(r)
        if (sourceRow.height) targetRow.height = sourceRow.height
        for (let c = 1; c <= maxColumn; c++) {
            const sourceCell = sourceRow.getCell(c)
            const targetCell = targetRow.getCell(c)
            const value = sourceCell.value
            if (value !== null && value !== undefined) {
                targetCell.value = value instanceof Date ? new Date(value.getTime())
                    : typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value
            }
            targetCell.style = JSON.parse(JSON.stringify(sourceCell.style ?? {}))
        }
    }

    ;(source.model.merges as string[]).forEach(range => target.mergeCells(range))

    const paintCell = (cell: ExcelJS.Cell) => {
        cell.master.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${DIFF_FILL}` } }
    }
    paints.forEach((columns, rowNumber) => {
        if (columns === null) {
            for (let c = 1; c <= maxColumn; c++) paintCell(target.getRow(rowNumber).getCell(c))
        } else {
            columns.forEach(c => paintCell(target.getRow(rowNumber).getCell(c)))
        }
    })

    return target
}

function qtyNumFmt(value: number): string {
    return Math.floor(value) === value ? '#,##0' : '#,##0.###'
}

function writeTitle(worksheet: ExcelJS.Worksheet, spanTo: string, title: string, subtitle: string) {
    worksheet.mergeCells(`A1:${spanTo}1`)
    const titleCell = worksheet.getCell('A1')
    titleCell.value = title
    titleCell.font = { bold: true, size: 16 }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

    worksheet.mergeCells(`A2:${spanTo}2`)
    const infoCell = worksheet.getCell('A2')
    infoCell.value = subtitle
    infoCell.alignment = { horizontal: 'center' }
    infoCell.font = { italic: true }
}

function writeHeader(worksheet: ExcelJS.Worksheet, rowNumber: number, headers: string[]) {
    const row = worksheet.getRow(rowNumber)
    headers.forEach((header, index) => {
        const cell = row.getCell(index + 1)
        cell.value = header
        cell.font = { bold: true, color: { argb: 'FFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = BORDER
    })
}

function styleDataRow(row: ExcelJS.Row, columnCount: number, centerColumns: number[], rightColumns: number[]) {
    for (let i = 1; i <= columnCount; i++) {
        const cell = row.getCell(i)
        cell.border = BORDER
        if (centerColumns.includes(i)) cell.alignment = { horizontal: 'center' }
        if (rightColumns.includes(i)) cell.alignment = { horizontal: 'right' }
    }
}

function writeQtyCell(cell: ExcelJS.Cell, value: number, emphasize = false) {
    cell.value = value
    cell.numFmt = qtyNumFmt(value)
    cell.alignment = { horizontal: 'right' }
    if (emphasize) {
        cell.font = {
            bold: true,
            color: { argb: value < 0 ? 'DC2626' : value > 0 ? '16A34A' : '6B7280' },
        }
    }
}

function pushUnitTotals(worksheet: ExcelJS.Worksheet, rowIndex: number, columnCount: number, rows: StocktakeDiffRow[], qtyColumns: { before: number; after: number; diff: number }) {
    // Cộng ONLY trong từng đơn vị — không có dòng tổng xuyên đơn vị
    const byUnit = new Map<string, { before: number; after: number }>()
    rows.forEach(row => {
        const unit = row.unit || '(không rõ ĐVT)'
        const acc = byUnit.get(unit) || { before: 0, after: 0 }
        acc.before += row.beforeQty
        acc.after += row.afterQty
        byUnit.set(unit, acc)
    })
    Array.from(byUnit.entries())
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
        .forEach(([unit, acc]) => {
            const row = worksheet.getRow(rowIndex)
            row.getCell(1).value = `TỔNG (trong đơn vị ${unit})`
            row.getCell(qtyColumns.before).value = Math.round(acc.before * 1000) / 1000
            row.getCell(qtyColumns.before).numFmt = qtyNumFmt(acc.before)
            row.getCell(qtyColumns.after).value = Math.round(acc.after * 1000) / 1000
            row.getCell(qtyColumns.after).numFmt = qtyNumFmt(acc.after)
            const diff = Math.round((acc.after - acc.before) * 1000) / 1000
            writeQtyCell(row.getCell(qtyColumns.diff), diff, true)
            row.getCell(1).font = { bold: true, italic: true }
            for (let i = 1; i <= columnCount; i++) row.getCell(i).border = BORDER
            rowIndex++
        })
    return rowIndex
}

interface DetailColumn {
    header: string
    width: number
    value: (row: StocktakeDiffRow, index: number) => string | number
    align?: 'center' | 'right'
    qty?: boolean
    emphasize?: boolean
}

const QTY_COLUMNS = { before: 'SL trước', after: 'SL sau', diff: 'Chênh lệch' }

/** Sheet chi tiết đổi bộ cột theo định dạng: sơ đồ có toạ độ, tồn theo LOT chỉ có danh mục + SP × ĐVT. */
function buildDetailColumns(format: StocktakeFormat): DetailColumn[] {
    const qtyCols: DetailColumn[] = [
        { header: QTY_COLUMNS.before, width: 12, value: row => row.beforeQty, align: 'right', qty: true },
        { header: QTY_COLUMNS.after, width: 12, value: row => row.afterQty, align: 'right', qty: true },
        { header: QTY_COLUMNS.diff, width: 13, value: row => row.diff, align: 'right', qty: true, emphasize: true },
        { header: 'Loại sai lệch', width: 22, value: row => describeKind(row.kind), align: 'center' },
    ]

    if (format === 'lot') {
        return [
            { header: 'STT', width: 6, value: (_, index) => index + 1, align: 'center' },
            { header: 'Danh mục', width: 26, value: row => row.category || '—' },
            { header: 'Mã SP (SKU)', width: 20, value: row => row.sku },
            { header: 'Sản phẩm', width: 40, value: row => row.productName },
            { header: 'ĐVT', width: 12, value: row => row.unit, align: 'center' },
            ...qtyCols,
        ]
    }

    return [
        { header: 'STT', width: 6, value: (_, index) => index + 1, align: 'center' },
        { header: 'Kho', width: 14, value: row => row.warehouse, align: 'center' },
        { header: 'Dãy', width: 12, value: row => row.rowName, align: 'center' },
        { header: 'Ô / Khu vực', width: 14, value: row => row.binName, align: 'center' },
        { header: 'Tầng', width: 10, value: row => row.levelName, align: 'center' },
        { header: 'Mã vị trí', width: 20, value: row => row.positionCode || '—', align: 'center' },
        { header: 'Số lô (Lot)', width: 20, value: row => row.lotCode || '—', align: 'center' },
        { header: 'Sản phẩm', width: 34, value: row => row.productName },
        { header: 'Mã SP (SKU)', width: 18, value: row => row.sku },
        { header: 'ĐVT', width: 12, value: row => row.unit, align: 'center' },
        ...qtyCols,
    ]
}

function columnLetter(index: number): string {
    return String.fromCharCode(65 + index)
}

// ============================== BIÊN BẢN KIỂM KÊ (chỉ lượt tồn theo LOT) ==============================

const MINUTES_HEADERS = [
    'STT', 'Mã SP', 'Tên sản phẩm', 'ĐVT',
    'SL trước kiểm kê', 'SL sau kiểm kê', 'Chênh lệch', 'Quy đổi (Kg) sau kiểm kê',
    'Ghi chú / nguyên nhân chênh lệch',
]
const MINUTES_WIDTHS = [5, 18, 40, 10, 13, 13, 12, 15, 26]
const MINUTES_LAST_COL = 9

function buildInventoryMinutesSheet(
    reportWorkbook: ExcelJS.Workbook,
    reconciliation: StocktakeReconciliation,
    companyInfo: CompanyInfo | null,
) {
    const ws = reportWorkbook.addWorksheet('Biên bản kiểm kê')
    // Chỉ set key + width: để không bị exceljs tự viết tên cột xuống dòng 1 (dòng này dành cho quốc hiệu)
    ws.columns = MINUTES_HEADERS.map((_, index) => ({ key: `c${index + 1}`, width: MINUTES_WIDTHS[index] }))
    ws.pageSetup = {
        paperSize: 9, // A4
        orientation: 'landscape', // 9 cột (tên hàng + ghi chú nguyên nhân) — in đứng sẽ bị ép chữ quá nhỏ
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.75, right: 0.75, top: 1.4, bottom: 1.4, header: 0.4, footer: 0.4 },
    }

    const setText = (
        ref: string,
        value: string,
        opts: { bold?: boolean; italic?: boolean; size?: number; align?: 'left' | 'center' | 'right'; wrap?: boolean } = {},
    ) => {
        const cell = ws.getCell(ref)
        cell.value = value
        cell.font = { bold: opts.bold, italic: opts.italic, size: opts.size ?? 11 }
        cell.alignment = { horizontal: opts.align ?? 'left', vertical: 'middle', wrapText: opts.wrap }
        return cell
    }
    const mergeLine = (rowNumber: number, text: string, opts: Parameters<typeof setText>[2] = {}) => {
        ws.mergeCells(`A${rowNumber}:I${rowNumber}`)
        return setText(`A${rowNumber}`, text, opts)
    }

    const kho = reconciliation.before.zoneName || reconciliation.after.zoneName
        || reconciliation.before.systemName || reconciliation.after.systemName || '………………'
    const ngayLap = new Date().toLocaleDateString('vi-VN')

    // Đầu trang chép đúng bố cục header của báo cáo gốc: 3 dòng đơn vị → spacer → tiêu đề → mốc ngày → "Kho:"
    const mocNgay = reconciliation.after.exportDate || reconciliation.before.exportDate
        || `Ngày lập biên bản: ${ngayLap}`
    ws.mergeCells('A1:C1'); ws.mergeCells('A2:C2'); ws.mergeCells('A3:C3')
    setText('A1', (companyInfo?.name || 'CÔNG TY ………………………').toUpperCase(), { bold: true, size: 11 })
    setText('A2', companyInfo?.address ? `Địa chỉ: ${companyInfo.address}` : '', { size: 10 })
    setText('A3', [
        companyInfo?.email ? `Email: ${companyInfo.email}` : '',
        companyInfo?.phone ? `ĐT: ${companyInfo.phone}` : '',
    ].filter(Boolean).join(' | '), { size: 10 })

    mergeLine(5, 'BÁO CÁO KIỂM KÊ', { bold: true, size: 16, align: 'center' })
    ws.getRow(5).height = 26
    mergeLine(6, mocNgay, { italic: true, size: 11, align: 'center' })
    setText('A7', `Kho: ${kho}`, { bold: true, size: 11 })

    const r3 = (value: number) => Math.round(value * 1000) / 1000
    const fillRow = (row: ExcelJS.Row, argb: string) => {
        for (let c = 1; c <= MINUTES_LAST_COL; c++) {
            row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
        }
    }

    // Bảng kiểu sheet "Tổng hợp" của báo cáo LOT: chữ đen đậm trên nền xám nhạt, không khối chữ xanh
    const headerRow = ws.getRow(8)
    MINUTES_HEADERS.forEach((header, index) => {
        const cell = headerRow.getCell(index + 1)
        cell.value = header
        cell.font = { bold: true }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = BORDER
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
    })
    headerRow.height = 28

    // Biên bản ghi nhận TOÀN BỘ mục sản phẩm của cả 2 mốc (không riêng hàng lệch),
    // chia nhóm "DANH MỤC:" đúng như sheet Tổng hợp của file gốc; dòng lệch tô đỏ.
    let r = 9
    let stt = 1
    let lastCategory: string | null = null
    let groupKg = { before: 0, after: 0 }

    const writeGroupTotal = (category: string) => {
        const totalRow = ws.getRow(r)
        ws.mergeCells(`A${r}:D${r}`)
        setText(`A${r}`, `TỔNG QUY ĐỔI (Kg)${category ? ` — DANH MỤC: ${category}` : ''}`, { bold: true, italic: true })
        writeQtyCell(totalRow.getCell(5), r3(groupKg.before))
        writeQtyCell(totalRow.getCell(6), r3(groupKg.after))
        writeQtyCell(totalRow.getCell(7), r3(groupKg.after - groupKg.before))
        for (let c = 1; c <= MINUTES_LAST_COL; c++) totalRow.getCell(c).border = BORDER
        groupKg = { before: 0, after: 0 }
        r++
    }

    reconciliation.allRows.forEach(row => {
        const category = row.category || ''
        if (category !== lastCategory) {
            if (lastCategory !== null) writeGroupTotal(lastCategory)
            const bannerRow = ws.getRow(r)
            ws.mergeCells(`A${r}:D${r}`)
            setText(`A${r}`, category ? `DANH MỤC: ${category.toUpperCase()}` : 'DANH MỤC: (chưa phân nhóm)', { bold: true })
            for (let c = 1; c <= MINUTES_LAST_COL; c++) bannerRow.getCell(c).border = BORDER
            fillRow(bannerRow, 'FFFFF2CC')
            lastCategory = category
            r++
        }

        const excelRow = ws.getRow(r)
        excelRow.getCell(1).value = stt++
        excelRow.getCell(2).value = row.sku
        excelRow.getCell(3).value = row.productName
        excelRow.getCell(4).value = row.unit
        writeQtyCell(excelRow.getCell(5), row.beforeQty)
        writeQtyCell(excelRow.getCell(6), row.afterQty)
        writeQtyCell(excelRow.getCell(7), row.diff)
        writeQtyCell(excelRow.getCell(8), row.afterKg)
        // Dòng chỉ có ở một mốc thì in sẵn nguyên nhân; dòng lệch số lượng để trống cho kiểm kê viên ghi tay
        excelRow.getCell(9).value = row.kind === 'only_after' ? 'Phát sinh ở mốc sau'
            : row.kind === 'only_before' ? 'Mất ở mốc sau' : ''
        styleDataRow(excelRow, MINUTES_LAST_COL, [1, 4], [5, 6, 7, 8])
        excelRow.getCell(3).alignment = { wrapText: true }
        excelRow.getCell(9).alignment = { wrapText: true }
        excelRow.font = { bold: true } // dòng sản phẩm in đậm như sheet Tổng hợp gốc; lệch thì nền đỏ
        if (row.kind !== 'same') fillRow(excelRow, `FF${DIFF_FILL}`)
        groupKg.before += row.beforeKg
        groupKg.after += row.afterKg
        r++
    })
    if (lastCategory !== null) writeGroupTotal(lastCategory)

    r++

    // Khối chữ ký: 2 tầng × 2 block (A:D và E:I)
    const signBlock = (rowNumber: number, leftTitle: string, rightTitle: string) => {
        ws.mergeCells(`A${rowNumber}:D${rowNumber}`)
        ws.mergeCells(`E${rowNumber}:I${rowNumber}`)
        setText(`A${rowNumber}`, leftTitle, { bold: true, size: 10, align: 'center' })
        setText(`E${rowNumber}`, rightTitle, { bold: true, size: 10, align: 'center' })
        ws.getRow(rowNumber).height = 18
        for (let i = 1; i <= 4; i++) ws.getRow(rowNumber + i).height = 16
        const nameRow = rowNumber + 5
        ws.mergeCells(`A${nameRow}:D${nameRow}`)
        ws.mergeCells(`E${nameRow}:I${nameRow}`)
        setText(`A${nameRow}`, 'Họ và tên: ................................', { italic: true, size: 9, align: 'center' })
        setText(`E${nameRow}`, 'Họ và tên: ................................', { italic: true, size: 9, align: 'center' })
        return nameRow + 2
    }

    mergeLine(r, `Ngày …… tháng …… năm ……`, { italic: true, size: 10, align: 'center' })
    r += 2
    r = signBlock(r, 'NGƯỜI KIỂM KÊ', 'THỦ KHO')
    signBlock(r, 'KẾ TOÁN TRƯỞNG', 'GIÁM ĐỐC')
}

export async function exportStocktakeDiffToExcel(
    reconciliation: StocktakeReconciliation,
    rows?: StocktakeDiffRow[],
    options?: { companyInfo?: CompanyInfo | null },
) {
    const detailRows = rows ?? reconciliation.diffRows
    const format = reconciliation.format
    const formatLabel = FORMAT_LABEL[format]
    const systemLabel = reconciliation.before.systemName || reconciliation.after.systemName
        || reconciliation.before.zoneName || reconciliation.after.zoneName || 'KHO'
    const snapshotSheetPrefix = format === 'lot' ? 'Tồn kho' : 'Sơ đồ'
    const workbook = new ExcelJS.Workbook()

    const subtitle = `Kho: ${systemLabel} | So sánh ${formatLabel}: ${reconciliation.before.fileName} (trước) ↔ ${reconciliation.after.fileName} (sau)`

    // ===== SHEET 1 (riêng lượt LOT): biên bản kiểm kê để in và ký =====
    if (format === 'lot') {
        buildInventoryMinutesSheet(workbook, reconciliation, options?.companyInfo ?? null)
    }

    // ===== SHEET sơ đồ/tồn gốc đầy đủ, tô đỏ chỗ lệch =====
    const diffKeys = new Set(reconciliation.diffRows.map(row => row.key))
    cloneSnapshotSheet(workbook, reconciliation.before, `${snapshotSheetPrefix} TRƯỚC`, diffKeys)
    cloneSnapshotSheet(workbook, reconciliation.after, `${snapshotSheetPrefix} SAU`, diffKeys)

    // ============================== SHEET 3: CHI TIẾT ==============================
    const detailColumns = buildDetailColumns(format)
    const columnCount = detailColumns.length
    const lastLetter = columnLetter(columnCount - 1)

    const sheet1 = workbook.addWorksheet('Chi tiết sai lệch')
    sheet1.columns = detailColumns.map((col, index) => ({ header: col.header, key: `c${index + 1}`, width: col.width }))
    writeTitle(sheet1, lastLetter, `BÁO CÁO ĐỐI CHIẾU KIỂM KÊ — ${formatLabel.toUpperCase()}`, subtitle)
    writeHeader(sheet1, 4, detailColumns.map(col => col.header))

    let rowIdx = 5
    detailRows.forEach((row, index) => {
        const excelRow = sheet1.getRow(rowIdx)
        detailColumns.forEach((col, i) => {
            const cell = excelRow.getCell(i + 1)
            if (col.qty) writeQtyCell(cell, col.value(row, index) as number, col.emphasize)
            else cell.value = col.value(row, index)
        })
        styleDataRow(
            excelRow,
            columnCount,
            detailColumns.map((col, i) => (col.align === 'center' ? i + 1 : 0)).filter(Boolean),
            detailColumns.map((col, i) => (col.align === 'right' ? i + 1 : 0)).filter(Boolean),
        )
        rowIdx++
    })

    if (detailRows.length === 0) {
        const emptyRow = sheet1.getRow(rowIdx)
        emptyRow.getCell(1).value = 'Không phát hiện dòng nào lệch số lượng giữa 2 mốc.'
        sheet1.mergeCells(`A${rowIdx}:${lastLetter}${rowIdx}`)
        emptyRow.getCell(1).font = { italic: true, color: { argb: '16A34A' } }
        rowIdx += 2
    } else {
        rowIdx++
        const qtyIndex = (header: string) => detailColumns.findIndex(col => col.header === header) + 1
        rowIdx = pushUnitTotals(sheet1, rowIdx, columnCount, detailRows, {
            before: qtyIndex(QTY_COLUMNS.before),
            after: qtyIndex(QTY_COLUMNS.after),
            diff: qtyIndex(QTY_COLUMNS.diff),
        })
    }

    // ============================== SHEET 4: THEO SẢN PHẨM ==============================
    /** Phạm vi truy vết được của một dòng lệch: vị trí vật lý (sơ đồ) hoặc khối danh mục (tồn theo LOT). */
    const scopeOf = (row: StocktakeDiffRow) => format === 'lot'
        ? (row.category || '(không có danh mục)')
        : describeLocation(row)

    const sheet2 = workbook.addWorksheet('Tổng hợp theo SP')
    const scopeHeader = format === 'lot' ? 'Số danh mục' : 'Số vị trí lệch'
    const headers2 = ['STT', 'Mã SP (SKU)', 'Sản phẩm', 'ĐVT', 'SL trước', 'SL sau', 'Chênh lệch', scopeHeader]
    sheet2.columns = headers2.map((header, index) => ({ header, key: `c${index + 1}`, width: [6, 20, 40, 14, 14, 14, 14, 14][index] }))
    writeTitle(sheet2, 'H', 'TỔNG HỢP SAI LỆCH THEO SẢN PHẨM', subtitle)
    writeHeader(sheet2, 4, headers2)

    const productMap = new Map<string, { sku: string; productName: string; unit: string; before: number; after: number; positions: Set<string> }>()
    detailRows.forEach(row => {
        const key = `${row.sku}|${row.productName}|${row.unit}`
        const acc = productMap.get(key) || { sku: row.sku, productName: row.productName, unit: row.unit, before: 0, after: 0, positions: new Set<string>() }
        acc.before += row.beforeQty
        acc.after += row.afterQty
        acc.positions.add(scopeOf(row))
        productMap.set(key, acc)
    })
    let rowIdx2 = 5
    Array.from(productMap.values())
        .sort((a, b) => a.productName.localeCompare(b.productName, undefined, { numeric: true }))
        .forEach((item, index) => {
            const row = sheet2.getRow(rowIdx2)
            row.getCell(1).value = index + 1
            row.getCell(2).value = item.sku
            row.getCell(3).value = item.productName
            row.getCell(4).value = item.unit
            writeQtyCell(row.getCell(5), Math.round(item.before * 1000) / 1000)
            writeQtyCell(row.getCell(6), Math.round(item.after * 1000) / 1000)
            writeQtyCell(row.getCell(7), Math.round((item.after - item.before) * 1000) / 1000, true)
            row.getCell(8).value = item.positions.size
            styleDataRow(row, 8, [1, 2, 4, 8], [5, 6, 7])
            rowIdx2++
        })
    rowIdx2++
    // Tổng theo từng đơn vị (không cộng xuyên đơn vị)
    const unitTotals2 = new Map<string, { before: number; after: number }>()
    Array.from(productMap.values()).forEach(item => {
        const acc = unitTotals2.get(item.unit || '(không rõ ĐVT)') || { before: 0, after: 0 }
        acc.before += item.before
        acc.after += item.after
        unitTotals2.set(item.unit || '(không rõ ĐVT)', acc)
    })
    Array.from(unitTotals2.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).forEach(([unit, acc]) => {
        const row = sheet2.getRow(rowIdx2)
        row.getCell(1).value = `TỔNG (${unit})`
        writeQtyCell(row.getCell(5), Math.round(acc.before * 1000) / 1000)
        writeQtyCell(row.getCell(6), Math.round(acc.after * 1000) / 1000)
        writeQtyCell(row.getCell(7), Math.round((acc.after - acc.before) * 1000) / 1000, true)
        row.getCell(1).font = { bold: true, italic: true }
        for (let i = 1; i <= 8; i++) row.getCell(i).border = BORDER
        rowIdx2++
    })

    // ============================== SHEET 5: THEO VỊ TRÍ (chỉ sơ đồ kho) ==============================
    if (format !== 'lot') {
        const sheet3 = workbook.addWorksheet('Tổng hợp theo vị trí')
        const headers3 = ['STT', 'Vị trí', 'ĐVT', 'SL trước', 'SL sau', 'Chênh lệch', 'Số dòng lệch', 'Chi tiết sản phẩm lệch']
        sheet3.columns = headers3.map((header, index) => ({ header, key: `c${index + 1}`, width: [6, 26, 14, 14, 14, 14, 12, 60][index] }))
        writeTitle(sheet3, 'H', 'TỔNG HỢP SAI LỆCH THEO VỊ TRÍ', subtitle)
        writeHeader(sheet3, 4, headers3)

        const locationMap = new Map<string, { location: string; unit: string; before: number; after: number; lines: string[] }>()
        detailRows.forEach(row => {
            const location = scopeOf(row)
            const key = `${location}|${row.unit}`
            const acc = locationMap.get(key) || { location, unit: row.unit, before: 0, after: 0, lines: [] as string[] }
            acc.before += row.beforeQty
            acc.after += row.afterQty
            acc.lines.push(`${row.productName || row.sku}: ${row.beforeQty} → ${row.afterQty}`)
            locationMap.set(key, acc)
        })
        let rowIdx3 = 5
        Array.from(locationMap.values())
            .sort((a, b) => a.location.localeCompare(b.location, undefined, { numeric: true }))
            .forEach((item, index) => {
                const row = sheet3.getRow(rowIdx3)
                row.getCell(1).value = index + 1
                row.getCell(2).value = item.location
                row.getCell(3).value = item.unit
                writeQtyCell(row.getCell(4), Math.round(item.before * 1000) / 1000)
                writeQtyCell(row.getCell(5), Math.round(item.after * 1000) / 1000)
                writeQtyCell(row.getCell(6), Math.round((item.after - item.before) * 1000) / 1000, true)
                row.getCell(7).value = item.lines.length
                row.getCell(8).value = item.lines.join(' | ')
                row.getCell(8).alignment = { wrapText: true }
                styleDataRow(row, 8, [1, 3, 7], [4, 5, 6])
                rowIdx3++
            })
    }

    // ============================== SHEET CUỐI: THÔNG TIN ==============================
    const sheet4 = workbook.addWorksheet('Thông tin đối chiếu')
    sheet4.columns = [
        { header: 'Khoản mục', key: 'label', width: 30 },
        { header: 'Giá trị', key: 'value', width: 90 },
    ]
    writeTitle(sheet4, 'B', 'THÔNG TIN LƯỢT ĐỐI CHIẾU', subtitle)
    writeHeader(sheet4, 4, ['Khoản mục', 'Giá trị'])

    const matchLevel = format === 'lot'
        ? 'Lệch số lượng (cùng sản phẩm + cùng ĐVT)'
        : 'Lệch số lượng (cùng vị trí + cùng lot/mã)'
    const paintRule = format === 'lot'
        ? `Dòng sản phẩm lệch bị tô hồng đỏ trên cả 2 sheet "${snapshotSheetPrefix} TRƯỚC" / "${snapshotSheetPrefix} SAU" (sheet "Tổng hợp" của 2 file gốc: mỗi sản phẩm × ĐVT đúng một dòng).`
        : format === 'table'
            ? 'Dòng lệch bị tô hồng đỏ trên cả 2 sheet sơ đồ.'
            : 'Ô chứa mặt hàng lệch bị tô hồng đỏ nguyên cả ô của tầng đó trên cả 2 sheet sơ đồ.'

    const facts: Array<[string, string | number]> = [
        ['Định dạng đối chiếu', formatLabel],
        ['File mốc TRƯỚC', reconciliation.before.fileName],
        ['File mốc SAU', reconciliation.after.fileName],
        ['Ngày xuất file trước', reconciliation.before.exportDate || '—'],
        ['Ngày xuất file sau', reconciliation.after.exportDate || '—'],
        ['Số dòng đọc được (trước / sau)', `${reconciliation.before.rows.length} / ${reconciliation.after.rows.length}`],
        ['Số dòng lệch', reconciliation.diffRows.length],
        [matchLevel, reconciliation.changedCount],
        ['Mất ở mốc sau', reconciliation.onlyBeforeCount],
        ['Phát sinh ở mốc sau', reconciliation.onlyAfterCount],
        [format === 'lot' ? 'Sản phẩm có sai lệch' : 'Vị trí có sai lệch', reconciliation.positionCount],
        [`Sheet ${snapshotSheetPrefix.toLowerCase()} đầy đủ`, `2 sheet "${snapshotSheetPrefix} TRƯỚC" / "${snapshotSheetPrefix} SAU" chép nguyên bản 2 file gốc, mọi dòng đều có — không chỉ dòng lệch.`],
        ['Ô/dòng tô đỏ', paintRule],
    ]
    if (format === 'lot') {
        facts.unshift(['Biên bản kiểm kê',
            'Sheet đầu "Biên bản kiểm kê" trình bày khổ A4 ngang để in: liệt kê TOÀN BỘ hàng hóa theo nhóm "DANH MỤC:" như file báo cáo, '
            + 'kèm SL trước / SL sau / Chênh lệch / Quy đổi (Kg) sau kiểm kê, tổng quy đổi Kg của từng danh mục, '
            + 'cột ghi chú nguyên nhân để viết tay và 4 ô chữ ký (Người kiểm kê / Thủ kho / Kế toán trưởng / Giám đốc). '
            + 'Dòng chênh lệch tô đỏ ngay trong biên bản.'])
    }
    let rowIdx4 = 5
    facts.forEach(([label, value]) => {
        const row = sheet4.getRow(rowIdx4)
        row.getCell(1).value = label
        row.getCell(2).value = typeof value === 'number' ? Math.round(value * 1000) / 1000 : value
        if (typeof value === 'number') row.getCell(2).numFmt = qtyNumFmt(value)
        row.getCell(1).font = { bold: true }
        styleDataRow(row, 2, [], [])
        rowIdx4++
    })

    rowIdx4++
    reconciliation.byUnit.forEach(unit => {
        const row = sheet4.getRow(rowIdx4)
        row.getCell(1).value = `Tổng trong đơn vị ${unit.unit}`
        row.getCell(2).value = `${unit.beforeQty}  →  ${unit.afterQty}   (chênh ${unit.diff > 0 ? '+' : ''}${unit.diff})`
        styleDataRow(row, 2, [], [])
        rowIdx4++
    })

    if (reconciliation.warnings.length) {
        rowIdx4++
        reconciliation.warnings.forEach((warning, index) => {
            const row = sheet4.getRow(rowIdx4)
            row.getCell(1).value = index === 0 ? 'CẢNH BÁO' : ''
            row.getCell(2).value = warning
            row.getCell(2).alignment = { wrapText: true }
            row.getCell(1).font = { bold: true, color: { argb: 'DC2626' } }
            row.getCell(2).font = { color: { argb: 'DC2626' } }
            styleDataRow(row, 2, [], [])
            rowIdx4++
        })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const fileTag = format === 'table' ? 'Bang' : format === 'grid' ? 'Luoi' : 'Lot'
    const fileName = `Doi_Chieu_Kiem_Ke_${fileTag}_${systemLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
    saveAs(new Blob([buffer]), fileName)
}
