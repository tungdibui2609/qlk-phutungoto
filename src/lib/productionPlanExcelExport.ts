import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { format } from 'date-fns'
import { calculatePlanMassBalance, formatDurationMinutes } from '@/lib/productionPlanService'
import { PLAN_MODE_CONFIG, PLAN_STATUS_CONFIG, ProductionPlan } from '@/components/production-plans/types'

const LOG_TYPE_LABELS: Record<string, string> = {
    ISSUE_INPUT: 'Xuất NL ra chuyền',
    RETURN_INPUT: 'Hoàn trả NL dư về kho',
    PRODUCE_PRIMARY: 'Nhập Thành phẩm chính',
    PRODUCE_BYPRODUCT: 'Thu hồi Phụ phẩm / Hạ cấp',
    RECORD_SCRAP: 'Ghi nhận Phế phẩm cân được'
}

function styleHeaderRow(row: ExcelJS.Row, bgHex = '1F2937') {
    row.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10, name: 'Arial' }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        }
    })
    row.height = 24
}

function styleDataRow(row: ExcelJS.Row) {
    row.eachCell(cell => {
        cell.font = { size: 10, name: 'Arial' }
        cell.border = {
            top: { style: 'thin', color: { argb: 'E5E7EB' } },
            left: { style: 'thin', color: { argb: 'E5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
            right: { style: 'thin', color: { argb: 'E5E7EB' } }
        }
    })
}

/**
 * Xuất Biên bản Quyết toán Cân bằng Vật tư, Hao hụt & Giá thành cho 1 Kế hoạch Sản xuất
 */
export async function exportProductionPlanSettlementExcel(
    plan: ProductionPlan,
    companyName = 'BÁO CÁO QUẢN TRỊ KHO - SẢN XUẤT - KẾ TOÁN'
): Promise<void> {
    const inputs = plan.production_plan_inputs || []
    const outputs = plan.production_plan_outputs || []
    const logs = plan.production_plan_logs || []
    const summary = calculatePlanMassBalance(plan, inputs, outputs, logs)

    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('Quyet Toan Hao Hut')

    ws.columns = [
        { width: 6 },
        { width: 34 },
        { width: 16 },
        { width: 14 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 16 },
        { width: 22 }
    ]

    // Title
    ws.mergeCells('A1:I1')
    ws.getCell('A1').value = companyName.toUpperCase()
    ws.getCell('A1').font = { bold: true, size: 11, name: 'Arial' }

    ws.mergeCells('A2:I2')
    ws.getCell('A2').value = 'BIÊN BẢN QUYẾT TOÁN KẾ HOẠCH SẢN XUẤT, CÂN BẰNG VẬT TƯ & HAO HỤT'
    ws.getCell('A2').font = { bold: true, size: 14, name: 'Arial', color: { argb: 'C2410C' } }
    ws.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(2).height = 28

    // Plan Info
    const modeLabel = PLAN_MODE_CONFIG[plan.plan_mode]?.label || plan.plan_mode
    const statusLabel = PLAN_STATUS_CONFIG[plan.status]?.label || plan.status

    const infoRows = [
        [`Mã Kế hoạch: ${plan.code}`, `Trạng thái: ${statusLabel}`, `Phân hệ kho: ${plan.system_code}`],
        [`Tên Kế hoạch: ${plan.name}`, `Chế độ: ${modeLabel}`, `Khu vực / Chuyền: ${plan.work_area_name || '---'}`],
        [
            `Bắt đầu thực tế: ${plan.actual_start_at ? format(new Date(plan.actual_start_at), 'dd/MM/yyyy HH:mm') : '---'}`,
            `Kết thúc thực tế: ${plan.actual_end_at ? format(new Date(plan.actual_end_at), 'dd/MM/yyyy HH:mm') : 'Đang chạy'}`,
            `Thời gian chạy ròng: ${formatDurationMinutes(summary.activeDurationMinutes)} (${plan.worker_count || '---'} nhân công)`
        ]
    ]

    let r = 4
    for (const info of infoRows) {
        ws.mergeCells(`A${r}:C${r}`)
        ws.mergeCells(`D${r}:F${r}`)
        ws.mergeCells(`G${r}:I${r}`)
        ws.getCell(`A${r}`).value = info[0]
        ws.getCell(`D${r}`).value = info[1]
        ws.getCell(`G${r}`).value = info[2]
        ws.getRow(r).font = { size: 10, bold: true, name: 'Arial' }
        r++
    }

    r++
    // Section I: Inputs
    ws.mergeCells(`A${r}:I${r}`)
    ws.getCell(`A${r}`).value = 'I. TỔNG HỢP NGUYÊN LIỆU ĐẦU VÀO XUẤT TỪ TỒN KHO'
    ws.getCell(`A${r}`).font = { bold: true, size: 11, name: 'Arial', color: { argb: '1D4ED8' } }
    r++

    const inHead = ws.getRow(r++)
    inHead.values = [
        'STT',
        'Tên Nguyên liệu',
        'Mã SKU',
        'ĐVT (Kg/ĐVT)',
        'Yêu cầu',
        'Đã xuất ra',
        'Hoàn trả kho',
        'Tiêu hao ròng (Kg)',
        'Giá trị vốn (VNĐ)'
    ]
    styleHeaderRow(inHead, '1E40AF')

    inputs.forEach((inp, idx) => {
        const netQty = Math.max(0, (Number(inp.issued_quantity) || 0) - (Number(inp.returned_quantity) || 0))
        const w = Number(inp.weight_per_unit_kg) || 1
        const netKg = Math.round(netQty * w * 100) / 100
        const cost = Math.round(netQty * (Number(inp.unit_cost) || 0))

        const row = ws.getRow(r++)
        row.values = [
            idx + 1,
            inp.products?.name || '---',
            inp.products?.sku || '---',
            `${inp.unit} (${w}kg)`,
            inp.is_open_quantity ? 'Xuất mở' : Number(inp.required_quantity) || 0,
            Number(inp.issued_quantity) || 0,
            Number(inp.returned_quantity) || 0,
            netKg,
            cost
        ]
        styleDataRow(row)
        row.getCell(8).numFmt = '#,##0.##'
        row.getCell(9).numFmt = '#,##0'
    })

    r++
    // Section II: Outputs
    ws.mergeCells(`A${r}:I${r}`)
    ws.getCell(`A${r}`).value = 'II. TỔNG HỢP THÀNH PHẨM CHÍNH, PHỤ PHẨM THU HỒI & PHẾ PHẨM'
    ws.getCell(`A${r}`).font = { bold: true, size: 11, name: 'Arial', color: { argb: '047857' } }
    r++

    const outHead = ws.getRow(r++)
    outHead.values = [
        'STT',
        'Tên Thành phẩm / Phụ phẩm',
        'Phân loại',
        'ĐVT (Kg/ĐVT)',
        'Mục tiêu',
        'Thực đạt',
        '% Đạt KH',
        'Quy đổi (Kg)',
        'Mã Lot TP / Ghi chú'
    ]
    styleHeaderRow(outHead, '065F46')

    outputs.forEach((out, idx) => {
        const w = Number(out.weight_per_unit_kg) || 1
        const target = Number(out.target_quantity) || 0
        const prod = Number(out.produced_quantity) || 0
        const pct = target > 0 ? `${Math.round((prod / target) * 100)}%` : '---'
        const typeLabel =
            out.output_type === 'PRIMARY'
                ? 'Thành phẩm chính'
                : out.output_type === 'BYPRODUCT'
                  ? 'Phụ phẩm thu hồi'
                  : 'Phế phẩm cân được'

        const row = ws.getRow(r++)
        row.values = [
            idx + 1,
            out.item_name,
            typeLabel,
            `${out.unit} (${w}kg)`,
            target,
            prod,
            pct,
            Math.round(prod * w * 100) / 100,
            out.target_lot_code || out.notes || ''
        ]
        styleDataRow(row)
        row.getCell(8).numFmt = '#,##0.##'
    })

    r++
    // Section III: Mass Balance & Accounting Cost Summary
    ws.mergeCells(`A${r}:I${r}`)
    ws.getCell(`A${r}`).value = 'III. BẢNG QUYẾT TOÁN CÂN BẰNG KHỐI LƯỢNG, HAO HỤT & GIÁ THÀNH KẾ TOÁN'
    ws.getCell(`A${r}`).font = { bold: true, size: 11, name: 'Arial', color: { argb: 'B45309' } }
    r++

    const balanceRows: Array<[string, string | number, string]> = [
        ['1. Tổng nguyên liệu xuất ra chuyền (Gross Input)', `${summary.grossInputKg.toLocaleString('vi-VN')} Kg`, ''],
        ['2. (-) Nguyên liệu dư hoàn trả lại kho', `${summary.returnedInputKg.toLocaleString('vi-VN')} Kg`, 'Không tính tiêu hao'],
        ['3. (=) Tổng nguyên liệu thực tiêu hao ròng (Net Input)', `${summary.netInputKg.toLocaleString('vi-VN')} Kg`, '100% đầu vào tính giá thành'],
        ['4. (-) Thành phẩm chính thu được', `${summary.primaryOutputKg.toLocaleString('vi-VN')} Kg`, `Tỷ lệ thu hồi TP chính: ${summary.primaryYieldPercent}%`],
        ['5. (-) Phụ phẩm / Hàng rớt cấp thu hồi nhập kho', `${summary.byproductOutputKg.toLocaleString('vi-VN')} Kg`, `Tổng thu hồi có ích: ${summary.totalRecoveryPercent}%`],
        ['6. (=) Tổng Hao hụt thực tế (3 - 4 - 5)', `${summary.totalLossKg.toLocaleString('vi-VN')} Kg`, `Tỷ lệ hao hụt: ${summary.lossPercent}% (Định mức cho phép: ${plan.allowed_loss_percent}%)`],
        ['   • Trong đó: Phế phẩm cân được (vỏ, hạt, hư)', `${summary.recordedScrapKg.toLocaleString('vi-VN')} Kg`, ''],
        ['   • Trong đó: Hao hụt tự nhiên / Ngót lạnh chênh lệch', `${summary.unaccountedShrinkageKg.toLocaleString('vi-VN')} Kg`, summary.isOverAllowedLoss ? `CẢNH BÁO: Vượt định mức +${summary.lossVariancePercent}%` : 'Đạt trong định mức cho phép'],
        ['7. Ước tính Tổng giá trị vốn NL tiêu hao', `${summary.totalInputMaterialCost.toLocaleString('vi-VN')} VNĐ`, `Đơn giá vốn NL / 1 Kg TP chính: ${summary.estimatedCostPerPrimaryKg.toLocaleString('vi-VN')} VNĐ/Kg`],
        ['8. Giải trình của Quản đốc SX / Kế toán', plan.settlement_notes || plan.notes || '---', `Năng suất: ${summary.throughputInputKgPerHour} Kg NL/giờ`]
    ]

    for (const [label, val, note] of balanceRows) {
        ws.mergeCells(`A${r}:D${r}`)
        ws.mergeCells(`E${r}:F${r}`)
        ws.mergeCells(`G${r}:I${r}`)
        const row = ws.getRow(r++)
        row.getCell(1).value = label
        row.getCell(5).value = val
        row.getCell(7).value = note
        styleDataRow(row)
        row.getCell(5).font = { bold: true, size: 10, name: 'Arial' }
    }

    r += 2
    const signRow = ws.getRow(r)
    ws.mergeCells(`A${r}:C${r}`)
    ws.mergeCells(`D${r}:F${r}`)
    ws.mergeCells(`G${r}:I${r}`)
    signRow.getCell(1).value = 'ĐẠI DIỆN BỘ PHẬN SẢN XUẤT'
    signRow.getCell(4).value = 'THỦ KHO QUẢN LÝ'
    signRow.getCell(7).value = 'KẾ TOÁN GIÁ THÀNH'
    signRow.font = { bold: true, size: 10, name: 'Arial' }
    signRow.alignment = { horizontal: 'center' }

    // Sheet 2: Nhật ký các đợt
    const wsLogs = workbook.addWorksheet('Nhat Ky Cac Dot')
    wsLogs.columns = [
        { width: 6 },
        { width: 18 },
        { width: 14 },
        { width: 24 },
        { width: 28 },
        { width: 18 },
        { width: 16 },
        { width: 13 },
        { width: 11 },
        { width: 14 },
        { width: 18 },
        { width: 26 }
    ]

    const logHead = wsLogs.getRow(1)
    logHead.values = [
        'STT',
        'Thời gian',
        'Ca / Đợt',
        'Loại giao dịch',
        'Sản phẩm / Mặt hàng',
        'Mã Pallet (LOT)',
        'Mã Lot SX gốc',
        'Số lượng',
        'ĐVT',
        'Quy đổi (Kg)',
        'Người thực hiện',
        'Ghi chú'
    ]
    styleHeaderRow(logHead, '374151')

    logs.forEach((l, idx) => {
        const row = wsLogs.getRow(idx + 2)
        row.values = [
            idx + 1,
            l.event_at ? format(new Date(l.event_at), 'dd/MM/yyyy HH:mm') : '---',
            l.shift_name || '---',
            LOG_TYPE_LABELS[l.log_type] || l.log_type,
            l.item_name,
            l.lot_code || '---',
            l.production_code || '---',
            Number(l.quantity) || 0,
            l.unit,
            Number(l.weight_kg) || 0,
            l.operator_name || '---',
            l.notes || ''
        ]
        styleDataRow(row)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(
        new Blob([buffer]),
        `Quyet_Toan_KHSX_${plan.code}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
    )
}

/**
 * Xuất Bảng Tổng hợp Danh sách Kế hoạch Sản xuất & Hiệu suất Hao hụt
 */
export async function exportProductionPlansSummaryExcel(
    plans: ProductionPlan[],
    systemName: string
): Promise<void> {
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('Tong Hop KHSX')

    ws.columns = [
        { width: 6 },
        { width: 18 },
        { width: 32 },
        { width: 20 },
        { width: 16 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 14 },
        { width: 13 },
        { width: 13 },
        { width: 16 }
    ]

    ws.mergeCells('A1:L1')
    ws.getCell('A1').value = `BÁO CÁO TỔNG HỢP KẾ HOẠCH SẢN XUẤT & HIỆU SUẤT THU HỒI - ${systemName.toUpperCase()}`
    ws.getCell('A1').font = { bold: true, size: 13, name: 'Arial', color: { argb: 'C2410C' } }
    ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 26

    const head = ws.getRow(3)
    head.values = [
        'STT',
        'Mã Kế hoạch',
        'Tên Kế hoạch',
        'Chế độ',
        'Trạng thái',
        'Tiêu hao ròng (Kg)',
        'Thành phẩm chính (Kg)',
        'Phụ phẩm (Kg)',
        'Tổng Hao hụt (Kg)',
        '% Thu hồi TP',
        '% Hao hụt',
        'Thời gian chạy'
    ]
    styleHeaderRow(head, '1F2937')

    plans.forEach((p, idx) => {
        const mb = calculatePlanMassBalance(
            p,
            p.production_plan_inputs || [],
            p.production_plan_outputs || [],
            p.production_plan_logs || []
        )
        const row = ws.getRow(idx + 4)
        row.values = [
            idx + 1,
            p.code,
            p.name,
            PLAN_MODE_CONFIG[p.plan_mode]?.shortLabel || p.plan_mode,
            PLAN_STATUS_CONFIG[p.status]?.label || p.status,
            mb.netInputKg,
            mb.primaryOutputKg,
            mb.byproductOutputKg,
            mb.totalLossKg,
            `${mb.primaryYieldPercent}%`,
            `${mb.lossPercent}%`,
            formatDurationMinutes(mb.activeDurationMinutes)
        ]
        styleDataRow(row)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(
        new Blob([buffer]),
        `Tong_Hop_Ke_Hoach_SX_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
    )
}
