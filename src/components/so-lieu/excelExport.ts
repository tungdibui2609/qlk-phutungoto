import { DeliveryJournalRecord } from './types'
import { formatDateTime } from './utils'

export async function exportDoneShiftToExcel(params: {
    systemName: string
    shift: any
    lines: DeliveryJournalRecord[]
    doneSubShifts: any[]
    buildEffectiveSubShifts: (subShifts: any[], lines: DeliveryJournalRecord[], shift: any) => any[]
    summarizeLines: (lines: DeliveryJournalRecord[], shift?: any) => any[]
}) {
    const { systemName, shift, lines, doneSubShifts, buildEffectiveSubShifts, summarizeLines } = params
    try {
        const ExcelJS = (await import('exceljs')).default
        const wb = new ExcelJS.Workbook()
        const jobName = shift.summary_data?.job_name || shift.notes || 'Công việc'

        const ws1 = wb.addWorksheet('Tổng hợp')
        ws1.addRow([`BÁO CÁO CÔNG VIỆC: ${jobName}`]).font = { bold: true, size: 14 }
        ws1.addRow([`Kho: ${systemName}`])
        ws1.addRow([`Thời gian: ${formatDateTime(shift.opened_at)} → ${formatDateTime(shift.closed_at)}`])
        ws1.addRow([`Người chốt: ${shift.closed_by_name || ''}`])
        ws1.addRow([])
        const h1 = ws1.addRow(['STT', 'Sản phẩm', 'ĐVT', 'Tổng nhập (+)', 'Tổng xuất (-)', 'Số đợt'])
        h1.font = { bold: true }
        summarizeLines(lines).forEach((r, i) => ws1.addRow([i + 1, r.product_name, r.unit, r.in_qty, r.out_qty, r.count]))
        ws1.columns = [{ width: 6 }, { width: 50 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 10 }]

        const ws2 = wb.addWorksheet('Chi tiết')
        const h2 = ws2.addRow(['STT', 'Thời gian', 'Đợt', 'Sản phẩm', 'Loại', 'Số lượng', 'ĐVT', 'Người thực hiện'])
        h2.font = { bold: true }
        lines.forEach((l, i) => {
            const isImport = l.to_department === 'Kho'
            ws2.addRow([i + 1, formatDateTime(l.sent_at), l.delivery_code || '', l.item_name, isImport ? 'Nhập' : 'Xuất', l.quantity_sent, l.unit, l.sent_by_name || ''])
        })
        ws2.columns = [{ width: 6 }, { width: 20 }, { width: 10 }, { width: 50 }, { width: 8 }, { width: 10 }, { width: 16 }, { width: 22 }]

        const effectiveSubs = buildEffectiveSubShifts(doneSubShifts, lines, shift)
        if (effectiveSubs.length > 0) {
            const ws3 = wb.addWorksheet('Chốt ca tạm')
            const h3 = ws3.addRow(['Đợt chốt tạm', 'Từ lúc', 'Đến lúc', 'Người chốt tạm', 'Sản phẩm', 'ĐVT', 'Nhập (+)', 'Xuất (-)', 'Ghi chú'])
            h3.font = { bold: true }
            effectiveSubs.forEach(ss => {
                const subLines: DeliveryJournalRecord[] = ss._subLines || []
                const prods = subLines.length > 0
                    ? summarizeLines(subLines)
                    : Object.values(ss.summary_data?.products_summary || {}).map((p: any) => ({
                        product_name: p.product_name,
                        unit: p.unit,
                        in_qty: p.in_qty || 0,
                        out_qty: p.out_qty || 0,
                        count: (p.in_count || 0) + (p.out_count || 0)
                    }))
                if (prods.length === 0) {
                    ws3.addRow([`Lần #${ss.sub_shift_number}`, formatDateTime(ss.from_time), formatDateTime(ss.to_time), ss.closed_by_name || '', '(Không phát sinh)', '', 0, 0, ss.notes || ''])
                } else {
                    prods.forEach((p: any) => {
                        ws3.addRow([`Lần #${ss.sub_shift_number}`, formatDateTime(ss.from_time), formatDateTime(ss.to_time), ss.closed_by_name || '', p.product_name, p.unit, p.in_qty, p.out_qty, ss.notes || ''])
                    })
                }
            })
            ws3.columns = [{ width: 14 }, { width: 20 }, { width: 20 }, { width: 22 }, { width: 45 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 30 }]
        }

        const buf = await wb.xlsx.writeBuffer()
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        const day = shift.closed_at ? new Date(shift.closed_at).toISOString().slice(0, 10) : ''
        a.href = url
        a.download = `So-lieu_${jobName.replace(/[\\/:*?"<>|]/g, '_')}_${day}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
    } catch (err: any) {
        alert('Lỗi xuất Excel: ' + (err?.message || err))
    }
}

export async function exportMultiShiftsToExcel(params: {
    systemName: string
    reportTitle: string
    shifts: any[]
    lines: DeliveryJournalRecord[]
    fileName: string
    aggregateShiftsProducts: (shifts: any[], lines: DeliveryJournalRecord[]) => any[]
}) {
    const { systemName, reportTitle, shifts, lines, fileName, aggregateShiftsProducts } = params
    try {
        const ExcelJS = (await import('exceljs')).default
        const wb = new ExcelJS.Workbook()

        // 1. Sheet Tổng hợp
        const ws1 = wb.addWorksheet('Tổng hợp')
        const titleRow = ws1.addRow([reportTitle.toUpperCase()])
        titleRow.font = { bold: true, size: 14 }
        ws1.addRow([`Kho: ${systemName}`])
        ws1.addRow([`Số công việc tham gia: ${shifts.length} công việc`])
        ws1.addRow([`Thời gian xuất: ${formatDateTime(new Date().toISOString())}`])
        ws1.addRow([])

        // Bảng mặt hàng
        const hSec1 = ws1.addRow(['1. TỔNG HỢP THEO MẶT HÀNG'])
        hSec1.font = { bold: true, size: 11 }
        const h1 = ws1.addRow(['STT', 'Sản phẩm', 'Công việc', 'ĐVT', 'Tổng nhập (+)', 'Tổng xuất (-)', 'Số đợt'])
        h1.font = { bold: true }
        h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }

        const prodRows = aggregateShiftsProducts(shifts, lines)

        prodRows.forEach((r, idx) => {
            const jobListStr = (r.jobs || []).map((j: any) => j.name).join(', ')
            ws1.addRow([
                idx + 1,
                r.product_name,
                jobListStr,
                r.unit,
                r.in_qty,
                r.out_qty,
                r.count
            ])
        })
        ws1.addRow([])

        // Bảng Đơn vị tính
        const hSec2 = ws1.addRow(['2. TỔNG HỢP THEO ĐƠN VỊ TÍNH'])
        hSec2.font = { bold: true, size: 11 }
        const h2 = ws1.addRow(['STT', 'Đơn vị tính', 'Tổng nhập (+)', 'Tổng xuất (-)'])
        h2.font = { bold: true }
        h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }

        const unitMap: Record<string, { unit: string; in_qty: number; out_qty: number }> = {}
        prodRows.forEach(r => {
            const u = r.unit || 'ĐVT'
            if (!unitMap[u]) unitMap[u] = { unit: u, in_qty: 0, out_qty: 0 }
            unitMap[u].in_qty += r.in_qty
            unitMap[u].out_qty += r.out_qty
        })
        Object.values(unitMap).forEach((u, idx) => {
            ws1.addRow([
                idx + 1,
                u.unit,
                u.in_qty,
                u.out_qty
            ])
        })
        ws1.addRow([])

        // Bảng Danh sách công việc
        const hSec3 = ws1.addRow(['3. DANH SÁCH CÁC CÔNG VIỆC'])
        hSec3.font = { bold: true, size: 11 }
        const h3 = ws1.addRow(['STT', 'Tên công việc', 'Trạng thái', 'Mở lúc', 'Đóng lúc', 'Người phụ trách', 'Số SP', 'Số đợt'])
        h3.font = { bold: true }
        h3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }

        shifts.forEach((s, idx) => {
            const pCount = Object.keys(s.summary_data?.products_summary || {}).length
            const rCount = s.summary_data?.total_records ?? 0
            ws1.addRow([
                idx + 1,
                s.summary_data?.job_name || s.notes || `Công việc #${idx + 1}`,
                s.status === 'closed' ? 'Đã chốt' : 'Đang mở',
                formatDateTime(s.opened_at),
                s.closed_at ? formatDateTime(s.closed_at) : 'Chưa chốt',
                s.closed_by_name || s.opened_by_name || '',
                pCount,
                rCount
            ])
        })

        ws1.columns = [
            { width: 6 },
            { width: 45 },
            { width: 18 },
            { width: 14 },
            { width: 14 },
            { width: 14 },
            { width: 18 },
            { width: 10 }
        ]

        // 2. Sheet Chi tiết nhật ký
        if (lines.length > 0) {
            const ws2 = wb.addWorksheet('Chi tiết đợt')
            const hLine = ws2.addRow(['STT', 'Thời gian', 'Mã công việc', 'Đợt', 'Sản phẩm', 'Loại', 'Số lượng', 'ĐVT', 'Người thực hiện', 'Ghi chú'])
            hLine.font = { bold: true }
            hLine.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }

            const shiftMap: Record<string, string> = {}
            shifts.forEach(s => {
                shiftMap[s.id] = s.summary_data?.job_name || s.notes || 'Công việc'
            })

            lines.forEach((l, idx) => {
                const isImport = l.to_department === 'Kho'
                const m = (l.notes || '').match(/\[CV_ID:\s*([^\]]+)\]/i)
                const sId = m ? m[1].trim() : ''
                const jName = shiftMap[sId] || ''
                ws2.addRow([
                    idx + 1,
                    formatDateTime(l.sent_at),
                    jName,
                    l.delivery_code || '',
                    l.item_name,
                    isImport ? 'Nhập (+)' : 'Xuất (-)',
                    l.quantity_sent,
                    l.unit,
                    l.sent_by_name || '',
                    l.notes || ''
                ])
            })

            ws2.columns = [
                { width: 6 },
                { width: 20 },
                { width: 30 },
                { width: 10 },
                { width: 45 },
                { width: 12 },
                { width: 12 },
                { width: 14 },
                { width: 22 },
                { width: 30 }
            ]
        }

        const buf = await wb.xlsx.writeBuffer()
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${fileName}.xlsx`
        a.click()
        URL.revokeObjectURL(url)
    } catch (err: any) {
        alert('Lỗi xuất Excel: ' + (err?.message || err))
    }
}
