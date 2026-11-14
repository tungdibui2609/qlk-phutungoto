import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { format } from 'date-fns'
import { FluctuationEvent, ProductFluctuationSummary, formatLotSttLabel } from './lotDailyFluctuation'

interface ExportDailyFluctuationParams {
    systemName: string
    dateRange: string
    summaries: ProductFluctuationSummary[]
    events: FluctuationEvent[]
}

export async function exportDailyFluctuationToExcel({
    systemName,
    dateRange,
    summaries,
    events
}: ExportDailyFluctuationParams) {
    const workbook = new ExcelJS.Workbook()

    // === SHEET 1: TỔNG HỢP DAO ĐỘNG SẢN PHẨM ===
    const summarySheet = workbook.addWorksheet('Tong Hop Dao Dong')
    summarySheet.columns = [
        { header: 'Mã SKU', key: 'sku', width: 16 },
        { header: 'Tên sản phẩm', key: 'name', width: 38 },
        { header: 'ĐVT', key: 'unit', width: 12 },
        { header: 'Nhập mới (+)', key: 'createdQty', width: 15 },
        { header: 'Bỏ thêm (+)', key: 'adjustedUpQty', width: 15 },
        { header: 'Bớt ra (-)', key: 'adjustedDownQty', width: 15 },
        { header: 'Xuất bán (-)', key: 'exportedQty', width: 15 },
        { header: 'Xóa LOT (-)', key: 'deletedQty', width: 15 },
        { header: 'Biến động ròng (+/-)', key: 'netDelta', width: 20 },
        { header: 'Số lượt', key: 'eventCount', width: 12 }
    ]

    summarySheet.mergeCells('A1:J1')
    const sTitle = summarySheet.getCell('A1')
    sTitle.value = `BÁO CÁO TỔNG HỢP BIẾN ĐỘNG HÀNG HÓA - ${systemName}`
    sTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } }
    sTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EA580C' } }
    sTitle.alignment = { vertical: 'middle', horizontal: 'center' }
    summarySheet.getRow(1).height = 28

    summarySheet.mergeCells('A2:J2')
    const sSub = summarySheet.getCell('A2')
    sSub.value = `Thời gian: ${dateRange} | Xuất lúc: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
    sSub.font = { italic: true, size: 10, color: { argb: '475569' } }
    sSub.alignment = { vertical: 'middle', horizontal: 'center' }
    summarySheet.getRow(2).height = 20

    const headerRow1 = summarySheet.getRow(4)
    summarySheet.columns.forEach((col, idx) => {
        const cell = headerRow1.getCell(idx + 1)
        cell.value = col.header as string
        cell.font = { bold: true, size: 10, color: { argb: '1E293B' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } }
        cell.border = {
            top: { style: 'thin', color: { argb: 'CBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
            left: { style: 'thin', color: { argb: 'CBD5E1' } },
            right: { style: 'thin', color: { argb: 'CBD5E1' } }
        }
        cell.alignment = { vertical: 'middle', horizontal: idx >= 3 ? 'right' : 'left' }
    })
    headerRow1.height = 24

    summaries.forEach((s, idx) => {
        const row = summarySheet.getRow(5 + idx)
        row.values = [
            s.sku,
            s.name,
            s.unit,
            s.createdQty,
            s.adjustedUpQty,
            s.adjustedDownQty,
            s.exportedQty,
            s.deletedQty,
            s.netDelta,
            s.eventCount
        ]
        row.eachCell((cell, colNum) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } }
            }
            if (colNum >= 4) {
                cell.alignment = { horizontal: 'right', vertical: 'middle' }
            }
            if (colNum === 9) {
                cell.font = {
                    bold: true,
                    color: { argb: s.netDelta > 0 ? '15803D' : s.netDelta < 0 ? 'DC2626' : '475569' }
                }
            }
        })
    })

    // === SHEET 2: CHI TIẾT DIỄN BIẾN TRONG NGÀY ===
    const detailSheet = workbook.addWorksheet('Chi Tiet Thao Tac')
    detailSheet.columns = [
        { header: 'Thời gian', key: 'time', width: 18 },
        { header: 'Nhân viên', key: 'performer', width: 22 },
        { header: 'Vị trí', key: 'positions', width: 16 },
        { header: 'Mã LOT', key: 'lotCode', width: 20 },
        { header: 'STT', key: 'stt', width: 10 },
        { header: 'Loại thao tác', key: 'title', width: 24 },
        { header: 'Chi tiết biến đổi', key: 'detail', width: 55 }
    ]

    detailSheet.mergeCells('A1:G1')
    const dTitle = detailSheet.getCell('A1')
    dTitle.value = `NHẬT KÝ CHI TIẾT BIẾN ĐỘNG - ${systemName}`
    dTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } }
    dTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } }
    dTitle.alignment = { vertical: 'middle', horizontal: 'center' }
    detailSheet.getRow(1).height = 28

    const headerRow2 = detailSheet.getRow(3)
    detailSheet.columns.forEach((col, idx) => {
        const cell = headerRow2.getCell(idx + 1)
        cell.value = col.header as string
        cell.font = { bold: true, size: 10, color: { argb: '1E293B' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } }
        cell.border = {
            top: { style: 'thin', color: { argb: 'CBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
            left: { style: 'thin', color: { argb: 'CBD5E1' } },
            right: { style: 'thin', color: { argb: 'CBD5E1' } }
        }
    })
    headerRow2.height = 24

    events.forEach((ev, idx) => {
        const deltaStr = ev.deltas.length > 0
            ? ev.deltas
                  .map(d => `[${d.sku}] ${d.name}: ${d.oldQty} -> ${d.newQty} ${d.unit} (${d.deltaQty > 0 ? '+' : ''}${d.deltaQty})`)
                  .join('\n')
            : ev.description

        const row = detailSheet.getRow(4 + idx)
        row.values = [
            format(new Date(ev.timestamp), 'dd/MM/yyyy HH:mm'),
            ev.performedBy?.name || 'Hệ thống',
            ev.positions.join(', ') || '-',
            ev.lotCode,
            formatLotSttLabel(ev.dailySeq) || '-',
            ev.title,
            deltaStr
        ]
        row.getCell(7).alignment = { wrapText: true, vertical: 'middle' }
        row.eachCell(cell => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'E2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
                left: { style: 'thin', color: { argb: 'E2E8F0' } },
                right: { style: 'thin', color: { argb: 'E2E8F0' } }
            }
        })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `Bien_Dong_Hang_Hoa_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`)
}
