import ExcelJS from 'exceljs'

/**
 * Đóng gói số liệu thống kê Dashboard thành .xlsx.
 *
 * `buildWorkbookFromSheets` dựng workbook theo danh sách sheet, mỗi sheet = tiêu đề + metadata
 * + ảnh biểu đồ + bảng số (bảng tự bắt đầu bên dưới ảnh).
 * `buildDashboardWorkbook` là wrapper giữ nguyên định dạng cũ 2 sheet "Bieu do"/"Du lieu"
 * cho các view chưa chuyển sang plan nhiều sheet.
 *
 * File này KHÔNG import file-saver hay canvas, nên test được bằng node thuần
 * (build → writeBuffer → load lại bằng exceljs).
 */

export type ExcelCellFormat = 'text' | 'int' | 'decimal' | 'percent'

export interface ExcelColumn {
    header: string
    width?: number
    format?: ExcelCellFormat
    align?: 'left' | 'right' | 'center'
}

export interface DashboardChartImage {
    base64: string
    width: number
    height: number
}

export interface ExcelMetaItem {
    label: string
    /** Truyền số (không phải chuỗi "6.744") để Excel còn tính và lọc được trên ô đó. */
    value: string | number
}

export interface DashboardTableBlock {
    columns?: ExcelColumn[]
    rows?: Array<Array<string | number | null>>
    /** Số cấp thụt đầu dòng của từng dòng (đồng thứ tự `rows`) — dùng cho bảng cây khu vực. */
    rowIndents?: number[]
    totalRow?: Array<string | number | null> | null
    notes?: string[]
    /** 1-based: cột % được tô thanh dữ liệu (conditional formatting) */
    dataBarColumn?: number
}

export interface DashboardSheetSpec extends DashboardTableBlock {
    sheetName: string
    title?: string
    meta?: ExcelMetaItem[]
    image?: DashboardChartImage | null
    /** Độ rộng cột A/B cho sheet chỉ có metadata, chưa có bảng. */
    metaColumnWidths?: [number, number]
}

export interface DashboardWorkbookSpec extends DashboardTableBlock {
    chartTitle: string
    meta?: ExcelMetaItem[]
    image?: DashboardChartImage | null
    columns: ExcelColumn[]
    rows: Array<Array<string | number | null>>
    chartSheetName?: string
    dataSheetName?: string
}

const NUM_FORMAT: Record<ExcelCellFormat, string | undefined> = {
    text: undefined,
    int: '#,##0',
    decimal: '#,##0.0',
    // Giá trị đã là 29.8 thì hiển thị "29.8%" — nhân 100 sẽ thành 2980%
    percent: '#,##0.0"%"'
}

const HEADER_FILL = 'FF44403C'
const TOTAL_FILL = 'FFF5F5F4'
const GRID = 'FFE7E5E4'

const thin = { style: 'thin' as const, color: { argb: GRID } }

function styleHeaderRow(row: ExcelJS.Row, columns: ExcelColumn[]) {
    row.eachCell((cell, colNumber) => {
        const col = columns[colNumber - 1]
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
        cell.alignment = { vertical: 'middle', horizontal: col?.align || (col?.format === 'text' ? 'left' : 'right') }
        cell.border = { top: thin, bottom: thin, left: thin, right: thin }
    })
    row.height = 22
}

function writeTable(ws: ExcelJS.Worksheet, block: DashboardTableBlock, headerRow: number) {
    const { columns = [], rowIndents, totalRow, notes, dataBarColumn } = block
    const rows = block.rows || []

    const header = ws.getRow(headerRow)
    columns.forEach((col, index) => {
        header.getCell(index + 1).value = col.header
    })
    styleHeaderRow(header, columns)

    let nextRow = headerRow + 1
    rows.forEach((values, idx) => {
        const row = ws.getRow(nextRow++)
        values.forEach((value, index) => {
            row.getCell(index + 1).value = value === null || value === '' ? null : value
        })
        const indent = rowIndents?.[idx] ?? 0
        row.eachCell((cell, colNumber) => {
            const col = columns[colNumber - 1]
            const format = col?.format || 'text'
            const numFmt = NUM_FORMAT[format]
            if (numFmt) cell.numFmt = numFmt
            cell.alignment = {
                horizontal: col?.align || (format === 'text' ? 'left' : 'right'),
                ...(colNumber === 1 && indent > 0 ? { indent } : {})
            }
            cell.border = { top: thin, bottom: thin, left: thin, right: thin }
            if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAF9' } }
            if (typeof cell.value === 'string' && cell.value.length > 60) cell.alignment = { wrapText: true, vertical: 'top' }
        })
    })

    if (totalRow && totalRow.length) {
        const row = ws.getRow(nextRow++)
        totalRow.forEach((value, index) => {
            row.getCell(index + 1).value = value === null || value === '' ? null : value
        })
        row.eachCell((cell, colNumber) => {
            const col = columns[colNumber - 1]
            const format = col?.format || 'text'
            const numFmt = NUM_FORMAT[format]
            if (numFmt) cell.numFmt = numFmt
            cell.font = { bold: true }
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }
            cell.alignment = { horizontal: col?.align || (format === 'text' ? 'left' : 'right') }
            cell.border = { top: { style: 'double', color: { argb: 'FFA8A29E' } }, bottom: thin, left: thin, right: thin }
        })
    }

    columns.forEach((col, i) => {
        ws.getColumn(i + 1).width = col.width || (col.format === 'text' ? 26 : 14)
    })

    if (rows.length > 0) {
        ws.views = [{ state: 'frozen', ySplit: headerRow }]
        ws.autoFilter = {
            from: { row: headerRow, column: 1 },
            to: { row: headerRow + rows.length, column: columns.length }
        }

        if (dataBarColumn) {
            const letter = ws.getColumn(dataBarColumn).letter
            ws.addConditionalFormatting({
                ref: `${letter}${headerRow + 1}:${letter}${headerRow + rows.length}`,
                // .d.ts của exceljs không khai báo `color` cho dataBar dù runtime vẫn đọc nó
                rules: [{
                    type: 'dataBar',
                    priority: 1,
                    gradient: false,
                    cfvo: [{ type: 'num', value: 0 }, { type: 'max' }],
                    color: { argb: 'FF10B981' }
                } as unknown as ExcelJS.ConditionalFormattingRule]
            })
        }
    }

    if (notes && notes.length) {
        nextRow++
        notes.forEach(note => {
            const row = ws.getRow(nextRow++)
            row.getCell(1).value = note
            row.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF78716C' } }
        })
    }
}

/** Một dòng Excel mặc định ~20px — dùng để chừa chỗ cho ảnh biểu đồ trước khi ghi bảng. */
const PX_PER_ROW = 20

function writeSheet(workbook: ExcelJS.Workbook, ws: ExcelJS.Worksheet, sheet: DashboardSheetSpec) {
    let cursor = 1

    if (sheet.title) {
        const title = ws.getCell(`A${cursor}`)
        title.value = sheet.title
        title.font = { bold: true, size: 15, color: { argb: 'FF1C1917' } }
        cursor += 2
    }

    if (sheet.metaColumnWidths) {
        ws.getColumn(1).width = sheet.metaColumnWidths[0]
        ws.getColumn(2).width = sheet.metaColumnWidths[1]
    }

    ;(sheet.meta || []).forEach(item => {
        const label = ws.getCell(`A${cursor}`)
        label.value = item.label
        label.font = { bold: true, size: 10, color: { argb: 'FF78716C' } }
        const value = ws.getCell(`B${cursor}`)
        value.value = item.value
        value.font = { size: 10, color: { argb: 'FF292524' } }
        if (typeof item.value === 'number') value.numFmt = '#,##0'
        cursor++
    })

    if (sheet.image && sheet.image.base64) {
        const id = workbook.addImage({ base64: sheet.image.base64, extension: 'png' })
        ws.addImage(id, {
            tl: { col: 0.2, row: cursor - 1 + 0.2 },
            ext: { width: sheet.image.width, height: sheet.image.height },
            editAs: 'oneCell'
        })
        cursor += Math.ceil(sheet.image.height / PX_PER_ROW) + 2
    } else if (sheet.meta && !sheet.columns) {
        ws.getCell(`A${cursor + 1}`).value = 'Không có ảnh biểu đồ cho view này — xem chi tiết ở sheet "Du lieu".'
        ws.getCell(`A${cursor + 1}`).font = { italic: true, size: 10, color: { argb: 'FFA8A29E' } }
    }

    if (sheet.columns && sheet.columns.length) {
        writeTable(ws, sheet, cursor)
    }
}

export function buildWorkbookFromSheets(sheets: DashboardSheetSpec[]): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AnyWarehouse'
    workbook.created = new Date()

    sheets.forEach(sheet => {
        const ws = workbook.addWorksheet(sheet.sheetName, {
            pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        })
        writeSheet(workbook, ws, sheet)
    })

    return workbook
}

/** Giữ nguyên định dạng cũ 2 sheet "Bieu do"/"Du lieu" cho các view chưa chuyển sang plan nhiều sheet. */
export function buildDashboardWorkbook(spec: DashboardWorkbookSpec): ExcelJS.Workbook {
    return buildWorkbookFromSheets([
        {
            sheetName: spec.chartSheetName || 'Bieu do',
            title: spec.chartTitle,
            meta: spec.meta,
            image: spec.image,
            metaColumnWidths: [34, 46]
        },
        {
            sheetName: spec.dataSheetName || 'Du lieu',
            columns: spec.columns,
            rows: spec.rows,
            totalRow: spec.totalRow,
            notes: spec.notes,
            dataBarColumn: spec.dataBarColumn
        }
    ])
}

export async function buildDashboardXlsxBuffer(spec: DashboardWorkbookSpec): Promise<ArrayBuffer> {
    return buildDashboardWorkbook(spec).xlsx.writeBuffer() as Promise<ArrayBuffer>
}

/** Tên file an toàn cho mọi trình duyệt: không dấu, không ký tự cấm. */
export function excelFileName(prefix: string, extra?: string, when: Date = new Date()) {
    const strip = (s: string) => s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase()
    const stamp = [
        when.getFullYear(),
        String(when.getMonth() + 1).padStart(2, '0'),
        String(when.getDate()).padStart(2, '0'),
        '_',
        String(when.getHours()).padStart(2, '0'),
        String(when.getMinutes()).padStart(2, '0')
    ].join('')
    return `${strip(prefix)}${extra ? '_' + strip(extra) : ''}_${stamp}.xlsx`
}
