import { describe, expect, it } from 'vitest'
import {
    calculatePlanMassBalance,
    formatDurationMinutes,
    resolveUnitWeightKg
} from '@/lib/productionPlanService'
import { ProductionPlanInput, ProductionPlanOutput } from '@/components/production-plans/types'

describe('productionPlanService - Mass Balance, Loss & Costing', () => {
    it('quy đổi chính xác trọng lượng đơn vị sang Kg (Tấn, Thùng 10kg, Kg)', () => {
        expect(resolveUnitWeightKg('Kg')).toBe(1)
        expect(resolveUnitWeightKg('Tấn')).toBe(1000)
        expect(resolveUnitWeightKg('Thùng (10kg)')).toBe(10)
        expect(resolveUnitWeightKg('Khay 2.5kg')).toBe(2.5)
    })

    it('Kịch bản 1 (INPUT_DRIVEN): Yêu cầu lấy A: 5 tấn + C: 6 tấn, có hoàn trả dư và tính hao hụt chuẩn', () => {
        const inputs: ProductionPlanInput[] = [
            {
                id: 'in-a',
                system_code: 'KHO_NVL',
                plan_id: 'plan-1',
                product_id: 'prod-a',
                unit: 'Tấn',
                weight_per_unit_kg: 1000,
                required_quantity: 5, // 5 tấn = 5,000 kg
                is_open_quantity: false,
                allocated_quantity: 5,
                issued_quantity: 5,
                returned_quantity: 0.2, // trả lại 0.2 tấn = 200 kg -> ròng 4,800 kg
                unit_cost: 80000000, // 80 triệu / tấn
                sort_order: 0
            },
            {
                id: 'in-c',
                system_code: 'KHO_NVL',
                plan_id: 'plan-1',
                product_id: 'prod-c',
                unit: 'Tấn',
                weight_per_unit_kg: 1000,
                required_quantity: 6, // 6 tấn = 6,000 kg
                is_open_quantity: false,
                allocated_quantity: 6,
                issued_quantity: 6,
                returned_quantity: 0, // ròng 6,000 kg
                unit_cost: 50000000, // 50 triệu / tấn
                sort_order: 1
            }
        ]

        // Tổng tiêu hao ròng = 4,800 + 6,000 = 10,800 kg
        const outputs: ProductionPlanOutput[] = [
            {
                id: 'out-1',
                system_code: 'KHO_NVL',
                plan_id: 'plan-1',
                product_id: 'prod-mix',
                item_name: 'Cơm sầu riêng phối chuẩn xuất khẩu',
                output_type: 'PRIMARY',
                unit: 'Kg',
                weight_per_unit_kg: 1,
                target_quantity: 9500,
                produced_quantity: 9600, // 9,600 kg
                cost_allocation_ratio: 100,
                sort_order: 0
            },
            {
                id: 'out-2',
                system_code: 'KHO_NVL',
                plan_id: 'plan-1',
                product_id: 'prod-paste',
                item_name: 'Cơm sầu riêng làm kem (Phụ phẩm)',
                output_type: 'BYPRODUCT',
                unit: 'Kg',
                weight_per_unit_kg: 1,
                target_quantity: 0,
                produced_quantity: 800, // 800 kg
                cost_allocation_ratio: 0,
                sort_order: 1
            },
            {
                id: 'out-3',
                system_code: 'KHO_NVL',
                plan_id: 'plan-1',
                item_name: 'Hạt & xơ loại bỏ',
                output_type: 'SCRAP',
                unit: 'Kg',
                weight_per_unit_kg: 1,
                target_quantity: 0,
                produced_quantity: 280, // cân được 280 kg phế phẩm
                cost_allocation_ratio: 0,
                sort_order: 2
            }
        ]

        const summary = calculatePlanMassBalance(
            {
                allowed_loss_percent: 4,
                actual_start_at: '2026-11-26T08:00:00Z',
                actual_end_at: '2026-11-26T14:30:00Z', // 390 phút - 30 phút nghỉ = 360 phút = 6 giờ
                paused_minutes: 30,
                worker_count: 10
            },
            inputs,
            outputs,
            []
        )

        expect(summary.requiredInputKg).toBe(11000)
        expect(summary.grossInputKg).toBe(11000)
        expect(summary.returnedInputKg).toBe(200)
        expect(summary.netInputKg).toBe(10800)
        expect(summary.primaryOutputKg).toBe(9600)
        expect(summary.byproductOutputKg).toBe(800)
        expect(summary.totalRecoverableOutputKg).toBe(10400)
        expect(summary.recordedScrapKg).toBe(280)
        // Hao hụt tự nhiên/ngót lạnh = 10,800 - 10,400 - 280 = 120 kg
        expect(summary.unaccountedShrinkageKg).toBe(120)
        expect(summary.totalLossKg).toBe(400)
        // % Hao hụt = 400 / 10,800 = 3.70% <= 4% định mức -> Đạt!
        expect(summary.lossPercent).toBe(3.7)
        expect(summary.isOverAllowedLoss).toBe(false)
        // Thời gian chạy thực tế = 360 phút (6 giờ) -> năng suất 10,800 / 6 = 1,800 kg/giờ
        expect(summary.activeDurationMinutes).toBe(360)
        expect(summary.throughputInputKgPerHour).toBe(1800)
        expect(summary.workerProductivityKgPerHour).toBe(180)
        expect(formatDurationMinutes(summary.activeDurationMinutes)).toBe('6 giờ')
    })

    it('Kịch bản 2 (OUTPUT_DRIVEN): Chạy đủ 500 thùng khay (10kg/thùng) từ Ri A xuất mở, phát hiện vượt định mức hao hụt', () => {
        const inputs: ProductionPlanInput[] = [
            {
                id: 'in-ria',
                system_code: 'KHO_NVL',
                plan_id: 'plan-2',
                product_id: 'prod-ria',
                unit: 'Kg',
                weight_per_unit_kg: 1,
                required_quantity: 0,
                is_open_quantity: true, // Không khống chế cứng lượng xuất ban đầu
                allocated_quantity: 7000,
                issued_quantity: 7000, // Đưa 7,000 kg Ri A ra lựa
                returned_quantity: 450, // Chọn đủ 500 thùng khay thì dư 450 kg Ri A trả lại kho -> Ròng = 6,550 kg
                unit_cost: 95000,
                sort_order: 0
            }
        ]

        const outputs: ProductionPlanOutput[] = [
            {
                id: 'out-tray',
                system_code: 'KHO_NVL',
                plan_id: 'plan-2',
                product_id: 'prod-tray',
                item_name: 'Sầu riêng Ri6 đóng khay xuất khẩu',
                output_type: 'PRIMARY',
                unit: 'Thùng (10kg)',
                weight_per_unit_kg: 10,
                target_quantity: 500,
                produced_quantity: 500, // Đạt đủ 500 thùng = 5,000 kg!
                cost_allocation_ratio: 100,
                sort_order: 0
            },
            {
                id: 'out-c',
                system_code: 'KHO_NVL',
                plan_id: 'plan-2',
                product_id: 'prod-c',
                item_name: 'Hàng Ri6 rớt cấp C thu hồi nhập kho',
                output_type: 'BYPRODUCT',
                unit: 'Kg',
                weight_per_unit_kg: 1,
                target_quantity: 0,
                produced_quantity: 1100, // Thu hồi lại 1,100 kg hàng C
                cost_allocation_ratio: 0,
                sort_order: 1
            }
        ]

        const summary = calculatePlanMassBalance(
            {
                allowed_loss_percent: 5, // Cho phép tối đa 5%
                actual_start_at: '2026-11-26T07:00:00Z',
                actual_end_at: '2026-11-26T12:00:00Z',
                paused_minutes: 0,
                worker_count: 8
            },
            inputs,
            outputs,
            []
        )

        expect(summary.netInputKg).toBe(6550)
        expect(summary.primaryOutputKg).toBe(5000)
        expect(summary.byproductOutputKg).toBe(1100)
        // Hao hụt ròng = 6,550 - (5,000 + 1,100) = 450 kg (6.87% > 5% -> Cảnh báo vượt định mức!)
        expect(summary.totalLossKg).toBe(450)
        expect(summary.lossPercent).toBe(6.87)
        expect(summary.primaryYieldPercent).toBe(76.34)
        expect(summary.totalRecoveryPercent).toBe(93.13)
        expect(summary.isOverAllowedLoss).toBe(true)
        expect(summary.lossVariancePercent).toBe(1.87)
    })
})
