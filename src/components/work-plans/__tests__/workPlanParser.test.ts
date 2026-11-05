import { describe, it, expect } from 'vitest'
import {
    parseRawPlanLine,
    formatVNDate,
    buildDefaultPlanTitle,
    parseUnitWeightKg,
    suggestWorkloadDifficulty,
    formatWorkloadSummaryText,
    recalculateWorkloadFromLinkedSources,
    applyQuantityFactorToMetrics,
} from '../types'

describe('workPlanParser & helpers', () => {
    it('formats YYYY-MM-DD into DD.MM.YYYY accurately', () => {
        expect(formatVNDate('2026-11-05')).toBe('05.11.2026')
        expect(buildDefaultPlanTitle('2026-11-05')).toBe('Kế hoạch làm việc kho ngày 05.11.2026')
    })

    it('parses the 6 real warehouse plan lines from user screenshot accurately', () => {
        const line1 = parseRawPlanLine(
            '1. Ướp đào tạo, hỗ trợ hướng dẫn Uy và Trôi chạy xe nâng xanh và xe nâng cao'
        )
        expect(line1.content).toBe(
            'Ướp đào tạo, hỗ trợ hướng dẫn Uy và Trôi chạy xe nâng xanh và xe nâng cao'
        )
        expect(line1.category).toBe('Đào tạo & Hỗ trợ')
        expect(line1.assignees.map(a => a.name)).toEqual(['Uy', 'Trôi'])

        const line2 = parseRawPlanLine(
            '2.Hạ hàng, đưa hàng ra đai hàng C hạt chuẩn bị xuất cont'
        )
        expect(line2.content).toBe('Hạ hàng, đưa hàng ra đai hàng C hạt chuẩn bị xuất cont')
        expect(line2.category).toBe('Xuất / Nhập cont')
        expect(line2.priority).toBe('important')

        const line3 = parseRawPlanLine('3. Vệ sinh dàn lạnh, quét tuyết và đập đá kho 1')
        expect(line3.content).toBe('Vệ sinh dàn lạnh, quét tuyết và đập đá kho 1')
        expect(line3.category).toBe('Vệ sinh & 5S')
        expect(line3.location_note.toLowerCase()).toContain('kho 1')

        const line4 = parseRawPlanLine('4. Đưa hàng ra cho sx làm hàng khay')
        expect(line4.content).toBe('Đưa hàng ra cho sx làm hàng khay')
        expect(line4.category).toBe('Hàng sản xuất / Khay')

        const line5 = parseRawPlanLine(
            '5. Dọn dẹp, quét bụi kho bao bì mới ( bụi, cát rất nhiều )'
        )
        expect(line5.content).toBe('Dọn dẹp, quét bụi kho bao bì mới ( bụi, cát rất nhiều )')
        expect(line5.category).toBe('Vệ sinh & 5S')
        expect(line5.location_note.toLowerCase()).toContain('kho bao bì mới')

        const line6 = parseRawPlanLine('6. Ghép hàng và đưa vào kho')
        expect(line6.content).toBe('Ghép hàng và đưa vào kho')
        expect(line6.category).toBe('Sắp xếp & Ghép hàng')
    })

    it('calculates workload weight, difficulty, and summary text from export orders', () => {
        expect(parseUnitWeightKg('Thùng (20kg)')).toBe(20)
        expect(parseUnitWeightKg('Khay (0.4kg)')).toBe(0.4)
        expect(parseUnitWeightKg('Kg')).toBe(1)

        expect(suggestWorkloadDifficulty({ positions_count: 52, packages_count: 1560 })).toBe(
            'very_heavy'
        )
        expect(suggestWorkloadDifficulty({ positions_count: 25 })).toBe('heavy')
        expect(suggestWorkloadDifficulty({ positions_count: 12 })).toBe('medium')
        expect(suggestWorkloadDifficulty({ positions_count: 4 })).toBe('light')

        const summary = formatWorkloadSummaryText({
            difficulty: 'very_heavy',
            positions_count: 52,
            packages_count: 1560,
            package_unit: 'Thùng (20kg)',
            weight_kg: 31200,
            linked_export_orders: [
                {
                    id: '509f5f48-0615-4eec-aec3-13e3ec5998d7',
                    code: 'đơn C hạt CUối',
                    status: 'Pending',
                    positions_count: 52,
                    lots_count: 52,
                    total_quantity: 1560,
                    unit: 'Thùng (20kg)',
                },
            ],
        })
        expect(summary).toContain('Rất nặng (x2)')
        expect(summary).toContain('52 Vị trí')
        expect(summary).toContain('31.2 Tấn')
        expect(summary).toContain('đơn C hạt CUối')
    })

    it('aggregates workload metrics from inbound, outbound, and LOT creation date summaries', () => {
        const recalculated = recalculateWorkloadFromLinkedSources({
            linked_inbound_orders: [
                {
                    id: 'inb-1',
                    code: 'PNK-20261105-001',
                    order_kind: 'inbound',
                    status: 'Completed',
                    items_count: 5,
                    total_quantity: 200,
                    unit: 'Thùng (20kg)',
                    estimated_weight_kg: 4000,
                },
            ],
            linked_lot_summaries: [
                {
                    id: '2026-11-05_ALL',
                    created_date: '2026-11-05',
                    zone_id: null,
                    zone_name: 'Tất cả kho',
                    lots_count: 17,
                    assigned_positions_count: 15,
                    total_quantity: 510,
                    unit: 'Thùng (20kg)',
                    estimated_weight_kg: 10200,
                },
            ],
        })

        expect(recalculated.positions_count).toBe(15)
        expect(recalculated.lots_count).toBe(22)
        expect(recalculated.packages_count).toBe(710)
        expect(recalculated.weight_kg).toBe(14200)
        expect(recalculated.difficulty).toBe('heavy')

        const text = formatWorkloadSummaryText(recalculated)
        expect(text).toContain('PNK-20261105-001')
        expect(text).toContain('17 LOT (05/11/2026)')
    })

    it('applies quantity factor (x2, 1/3, 1/2, x1) non-destructively from base metrics and includes reason', () => {
        const initial = {
            positions_count: 227,
            lots_count: 227,
            packages_count: 6718,
            weight_kg: 134360,
        }

        const doubled = applyQuantityFactorToMetrics(initial, 2, 'x2 (Nhân đôi)')
        expect(doubled.base_positions_count).toBe(227)
        expect(doubled.positions_count).toBe(454)
        expect(doubled.packages_count).toBe(13436)
        expect(doubled.weight_kg).toBe(268720)

        // Switching directly from x2 to 1/3 still uses original base 227 / 6718 / 134360
        const oneThird = applyQuantityFactorToMetrics(doubled, 1 / 3, '1/3 Khối lượng')
        expect(oneThird.positions_count).toBe(76)
        expect(oneThird.packages_count).toBe(2239.33)
        expect(oneThird.weight_kg).toBe(44787)

        // Switching back to x1 restores exact original numbers
        const restored = applyQuantityFactorToMetrics(oneThird, 1, 'x1 (Số gốc)')
        expect(restored.positions_count).toBe(227)
        expect(restored.packages_count).toBe(6718)
        expect(restored.weight_kg).toBe(134360)
        expect(restored.quantity_factor).toBeNull()
    })
})

