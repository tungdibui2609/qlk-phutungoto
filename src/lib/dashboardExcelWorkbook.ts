import ExcelJS from 'exceljs'

/**
 * Gộp dữ liệu thống kê Dashboard thành file .xlsx 2 sheet:
 *   "Bieu do" : tiêu đề + thông tin phân hệ/thời điểm + ảnh PNG biểu đồ
 *   "Du lieu" : bảng số lọc được (autofilter, đóng băng dòng đầu, format số)
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

export interface DashboardWorkbookSpec {
    chartTitle: string
    meta?: Array<{ label: string; value: string }>
    image?: DashboardChartImage | null
    columns: ExcelColumn[]
    rows: Array<Array<string | number | null>>
    totalRow?: Array<string | number | null> | null
    notes?: string[]
    /** 1-based: cột % được tô thanh dữ liệu (conditional formatting) trong sheet "Du lieu" */
    dataBarColumn?: number
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

function writeTable(ws: ExcelJS.Worksheet, spec: DashboardWorkbookSpec) {
    const { columns, rows, totalRow, notes, dataBarColumn } = spec
    const HEADER_ROW = 1

    const header = ws.addRow(columns.map(c => c.header))
    styleHeaderRow(header, columns)

    rows.forEach((values, idx) => {
        const row = ws.addRow(values.map(v => (v === null || v === '' ? null : v)))
        row.eachCell((cell, colNumber) => {
            const col = columns[colNumber - 1]
            const format = col?.format || 'text'
            const numFmt = NUM_FORMAT[format]
            if (numFmt) cell.numFmt = numFmt
            cell.alignment = { horizontal: col?.align || (format === 'text' ? 'left' : 'right') }
            cell.border = { top: thin, bottom: thin, left: thin, right: thin }
            if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAF9' } }
            if (typeof cell.value === 'string' && cell.value.length > 60) cell.alignment = { wrapText: true, vertical: 'top' }
        })
    })

    if (totalRow && totalRow.length) {
        const row = ws.addRow(totalRow.map(v => (v === null || v === '' ? null : v)))
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
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    const lastRow = HEADER_ROW + rows.length + (totalRow && totalRow.length ? 1 : 0)
    if (rows.length > 0) {
        ws.autoFilter = {
            from: { row: HEADER_ROW, column: 1 },
            to: { row: HEADER_ROW + rows.length, column: columns.length }
        }
    }

    if (dataBarColumn && rows.length > 0) {
        const letter = ws.getColumn(dataBarColumn).letter
        ws.addConditionalFormatting({
            ref: `${letter}${HEADER_ROW + 1}:${letter}${HEADER_ROW + rows.length}`,
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

    if (notes && notes.length) {
        let r = lastRow + 2
        notes.forEach(note => {
            const row = ws.getRow(r++)
            row.getCell(1).value = note
            row.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF78716C' } }
        })
    }
}

export function buildDashboardWorkbook(spec: DashboardWorkbookSpec): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'AnyWarehouse'
    workbook.created = new Date()

    const chartSheet = workbook.addWorksheet(spec.chartSheetName || 'Bieu do', {
        pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 1 }
    })
    chartSheet.getColumn(1).width = 34
    chartSheet.getColumn(2).width = 46

    chartSheet.getCell('A1').value = spec.chartTitle
    chartSheet.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF1C1917' } }

    let nextRow = 3
    ;(spec.meta || []).forEach(item => {
        chartSheet.getCell(`A${nextRow}`).value = item.label
        chartSheet.getCell(`A${nextRow}`).font = { bold: true, size: 10, color: { argb: 'FF78716C' } }
        chartSheet.getCell(`B${nextRow}`).value = item.value
        chartSheet.getCell(`B${nextRow}`).font = { size: 10, color: { argb: 'FF292524' } }
        nextRow++
    })

    if (spec.image && spec.image.base64) {
        const id = workbook.addImage({ base64: spec.image.base64, extension: 'png' })
        chartSheet.addImage(id, {
            tl: { col: 0.2, row: nextRow + 0.5 },
            ext: { width: spec.image.width, height: spec.image.height },
            editAs: 'oneCell'
        })
    } else {
        chartSheet.getCell(`A${nextRow + 1}`).value = 'Không có ảnh biểu đồ cho view này — xem chi tiết ở sheet "Du lieu".'
        chartSheet.getCell(`A${nextRow + 1}`).font = { italic: true, size: 10, color: { argb: 'FFA8A29E' } }
    }

    const dataSheet = workbook.addWorksheet(spec.dataSheetName || 'Du lieu')
    writeTable(dataSheet, spec)

    return workbook
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
