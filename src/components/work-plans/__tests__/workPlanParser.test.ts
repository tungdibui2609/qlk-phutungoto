import { describe, it, expect } from 'vitest'
import {
    parseRawPlanLine,
    formatVNDate,
    formatVNDateSlash,
    buildDefaultPlanTitle,
    parseUnitWeightKg,
    suggestWorkloadDifficulty,
    formatWorkloadSummaryText,
    recalculateWorkloadFromLinkedSources,
    applyQuantityFactorToMetrics,
    calculateAssigneeTaskStandardKpi,
    calculateWorkSpeed,
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

        // Thang đo công việc: 1 Cont ~ 45 vị trí ~ 27 tấn. Rất nặng: 1 trong 3 chỉ số đạt >= 8 Cont / >= 360 vị trí / >= 216 tấn
        expect(suggestWorkloadDifficulty({ containers_count: 8 })).toBe('very_heavy')
        expect(suggestWorkloadDifficulty({ positions_count: 360 })).toBe('very_heavy')
        expect(suggestWorkloadDifficulty({ weight_kg: 216000 })).toBe('very_heavy')
        expect(suggestWorkloadDifficulty({ positions_count: 180 })).toBe('heavy')
        expect(suggestWorkloadDifficulty({ containers_count: 4 })).toBe('heavy')
        expect(suggestWorkloadDifficulty({ positions_count: 52 })).toBe('medium')
        expect(suggestWorkloadDifficulty({ containers_count: 1 })).toBe('medium')
        expect(suggestWorkloadDifficulty({ positions_count: 20 })).toBe('light')

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
        expect(recalculated.difficulty).toBe('light') // < 45 vị trí / < 27 tấn => light

        const text = formatWorkloadSummaryText(recalculated)
        expect(text).toContain('PNK-20261105-001')
        expect(text).toContain('17 LOT (05/11/2026)')
    })

    it('aggregates workload metrics from approved assignments (Duyệt gán vị trí xe nâng)', () => {
        const recalculated = recalculateWorkloadFromLinkedSources({
            linked_approved_assignments: [
                {
                    id: '2026-11-04_ALL',
                    action_date: '2026-11-04',
                    zone_id: null,
                    zone_name: 'Tất cả kho',
                    approved_count: 12,
                    lots_count: 12,
                    total_quantity: 360,
                    unit: 'Thùng (20kg)',
                    estimated_weight_kg: 7200,
                },
            ],
        })

        expect(recalculated.positions_count).toBe(12)
        expect(recalculated.lots_count).toBe(12)
        expect(recalculated.packages_count).toBe(360)
        expect(recalculated.weight_kg).toBe(7200)
        expect(recalculated.difficulty).toBe('light') // < 45 vị trí => light

        const text = formatWorkloadSummaryText(recalculated)
        expect(text).toContain('Đưa lên kệ: 12 vị trí (04/11/2026)')
    })

    it('aggregates workload metrics from multiple selected days seamlessly', () => {
        const recalculated = recalculateWorkloadFromLinkedSources({
            linked_approved_assignments: [
                {
                    id: '2026-11-04_ZONE_1',
                    action_date: '2026-11-04',
                    zone_id: 'zone-1',
                    zone_name: 'KHO 1',
                    approved_count: 6,
                    lots_count: 6,
                    total_quantity: 180,
                    unit: 'Thùng (20kg)',
                    estimated_weight_kg: 3600,
                },
                {
                    id: '2026-11-05_ZONE_3',
                    action_date: '2026-11-05',
                    zone_id: 'zone-3',
                    zone_name: 'KHO 3',
                    approved_count: 8,
                    lots_count: 8,
                    total_quantity: 240,
                    unit: 'Thùng (20kg)',
                    estimated_weight_kg: 4800,
                },
            ],
        })

        // 6 on Nov 4 + 8 on Nov 5 = 14 positions
        expect(recalculated.positions_count).toBe(14)
        expect(recalculated.lots_count).toBe(14)
        expect(recalculated.packages_count).toBe(420)
        expect(recalculated.weight_kg).toBe(8400)

        const text = formatWorkloadSummaryText(recalculated)
        expect(text).toContain('6 vị trí (04/11/2026 - KHO 1)')
        expect(text).toContain('8 vị trí (05/11/2026 - KHO 3)')
    })

    it('supports date range summaries with .. delimiter', () => {
        expect(formatVNDateSlash('2026-11-04..2026-11-05')).toBe('04/11/2026 → 05/11/2026')

        const recalculated = recalculateWorkloadFromLinkedSources({
            linked_approved_assignments: [
                {
                    id: '2026-11-04..2026-11-05_ALL',
                    action_date: '2026-11-04..2026-11-05',
                    zone_id: null,
                    zone_name: 'Tất cả kho',
                    approved_count: 25,
                    lots_count: 25,
                    total_quantity: 750,
                    unit: 'Thùng (20kg)',
                    estimated_weight_kg: 15000,
                },
            ],
        })

        expect(recalculated.positions_count).toBe(25)
        expect(recalculated.difficulty).toBe('light') // 25 vị trí < 45 vị trí => light

        const text = formatWorkloadSummaryText(recalculated)
        expect(text).toContain('25 vị trí (04/11/2026 → 05/11/2026)')
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

    it('correctly separates carton-based lots (Thùng) from kg-based lots (Kg) without mixing kg into carton count', () => {
        // User's exact scenario on 04/11/2026:
        // 6 lots in KHO 1: 30 Thùng (20kg) each -> 180 Thùng, 3600 kg
        // 6 lots in KHO 3: total 2207.6 Kg -> 0 Thùng, 2207.6 kg
        const recalculated = recalculateWorkloadFromLinkedSources({
            linked_approved_assignments: [
                {
                    id: '2026-11-04_ALL',
                    action_date: '2026-11-04',
                    zone_id: null,
                    zone_name: 'Tất cả kho',
                    approved_count: 12,
                    lots_count: 12,
                    total_quantity: 180, // 180 Thùng, NOT 2387.6!
                    packages_count: 180,
                    package_unit: 'Thùng',
                    kg_quantity: 2207.6,
                    unit: 'Thùng',
                    estimated_weight_kg: 5808, // 3600 + 2207.6 = 5807.6 -> 5808 kg
                },
            ],
        })

        expect(recalculated.positions_count).toBe(12)
        expect(recalculated.lots_count).toBe(12)
        expect(recalculated.packages_count).toBe(180) // Must be exactly 180 Thùng
        expect(recalculated.weight_kg).toBe(5808) // Must be 5808 kg
        expect(recalculated.package_unit).toBe('Thùng')
    })

    it('suggests difficulty correctly based on 1 in 3 parameters (8 conts, 360 positions, 216 tons)', () => {
        // Rất nặng: 1 trong 3 thông số đạt (conts >= 8, pos >= 360, kg >= 216.000)
        expect(suggestWorkloadDifficulty({ containers_count: 8 })).toBe('very_heavy')
        expect(suggestWorkloadDifficulty({ positions_count: 360 })).toBe('very_heavy')
        expect(suggestWorkloadDifficulty({ weight_kg: 216000 })).toBe('very_heavy')

        // Nặng: 1 trong 3 thông số đạt (conts >= 4, pos >= 180, kg >= 108.000)
        expect(suggestWorkloadDifficulty({ containers_count: 4 })).toBe('heavy')
        expect(suggestWorkloadDifficulty({ positions_count: 180 })).toBe('heavy')
        expect(suggestWorkloadDifficulty({ weight_kg: 108000 })).toBe('heavy')

        // Vừa: 1 trong 3 thông số đạt (conts >= 1, pos >= 45, kg >= 27.000)
        expect(suggestWorkloadDifficulty({ containers_count: 1 })).toBe('medium')
        expect(suggestWorkloadDifficulty({ positions_count: 45 })).toBe('medium')
        expect(suggestWorkloadDifficulty({ weight_kg: 27000 })).toBe('medium')

        // Nhẹ: Dưới các ngưỡng trên
        expect(suggestWorkloadDifficulty({ containers_count: 0, positions_count: 20, weight_kg: 10000 })).toBe('light')
    })

    it('ensures partial/in-progress tasks do NOT reduce productivity score for multi-day tasks, but subjective delay is penalized via incident', () => {
        // Case 1: Công việc làm 2 ngày, ngày 1 mới "Một phần" (progressPercent = 60%)
        // Nhân viên làm việc hết mình cả ca -> Năng suất vẫn đạt chuẩn 40/40!
        const resultDay1 = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            diffMultiplier: 1.0,
            progressPercent: 60,
            ratingStars: 4,
            taskStatus: 'partial',
        })
        expect(resultDay1.productivityScore).toBe(40) // Không bị tụt xuống 24/40 hay 25/40 nữa!
        expect(resultDay1.qualityScore).toBe(20)
        expect(resultDay1.totalKpi).toBe(95) // 40 + 20 + 20 + 15 = 95đ

        // Case 2: Nhân viên lười biếng / chậm trễ do chủ quan -> Quản lý gán lỗi vi phạm (-5đ)
        const resultWithDelayIncident = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            diffMultiplier: 1.0,
            progressPercent: 60,
            ratingStars: 4,
            taskStatus: 'partial',
            incidents: [
                {
                    id: 'inc_1',
                    type: 'incomplete_task',
                    name: 'Chưa xong việc trong ca (chủ quan)',
                    group: 'operations',
                    severity: 'minor',
                    penalty_points: 5,
                    created_at: new Date().toISOString(),
                },
            ],
        })
        expect(resultWithDelayIncident.productivityScore).toBe(40)
        expect(resultWithDelayIncident.disciplineScore).toBe(10) // 15 - 5 = 10đ
        expect(resultWithDelayIncident.totalKpi).toBe(90) // 40 + 20 + 20 + 10 = 90đ

        // Case 3: Task bị cancelled -> Năng suất và KPI = 0
        const resultCancelled = calculateAssigneeTaskStandardKpi({
            userPositions: 45,
            diffMultiplier: 1.0,
            taskStatus: 'cancelled',
        })
        expect(resultCancelled.productivityScore).toBe(0)
        expect(resultCancelled.totalKpi).toBe(0)

        // Case 4: Công việc nhóm chia tỷ lệ (ví dụ Trôi làm 4.6 vị trí / 12 vị trí tổng = 38%)
        // Năng suất vẫn đạt đủ 40/40đ cơ sở chuẩn ca, không bị chia chia cắt làm tụt xuống 4.1đ!
        const resultGroupMember = calculateAssigneeTaskStandardKpi({
            userPositions: 4.6,
            diffMultiplier: 1.0,
            progressPercent: 100,
            ratingStars: 4,
            taskStatus: 'completed',
        })
        expect(resultGroupMember.productivityScore).toBe(40)
        expect(resultGroupMember.qualityScore).toBe(20)
        expect(resultGroupMember.totalKpi).toBe(95) // 40 + 20 + 20 + 15 = 95đ (Hạng A - Tốt)
        expect(resultGroupMember.grade).toBe('A')
        expect(resultGroupMember.gradeLabel).toBe('Tốt (A)')

        // Case 5: Quản lý tự chấm tay (override) điểm Năng suất và Chất lượng cho riêng từng nhân viên
        const resultCustomScores = calculateAssigneeTaskStandardKpi({
            userPositions: 4.6,
            diffMultiplier: 1.0,
            progressPercent: 60,
            ratingStars: 3, // Chung cả việc là 3 sao (15đ)
            taskStatus: 'partial',
            customProductivityScore: 38, // Chấm tay năng suất 38/40
            customQualityScore: 25, // Riêng người này làm rất đẹp, chấm tay 25/25
        })
        expect(resultCustomScores.productivityScore).toBe(38)
        expect(resultCustomScores.qualityScore).toBe(25)
        expect(resultCustomScores.totalKpi).toBe(98) // 38 + 25 + 20 + 15 = 98đ (Hạng A)
        expect(resultCustomScores.grade).toBe('A')

        // Case 6: Việc phụ / hỗ trợ ngoài ca -> Điểm hỗ trợ tự động tỷ lệ thuận theo % đóng góp
        // Người đóng góp 18% -> 40 * 18% = 7.2 điểm hỗ trợ
        const resultSupport18 = calculateAssigneeTaskStandardKpi({
            userPositions: 2.2,
            diffMultiplier: 1.0,
            taskType: 'secondary',
            sharePercent: 18,
            taskStatus: 'completed',
        })
        expect(resultSupport18.bonusOverTargetPoints).toBe(7.2)
        expect(resultSupport18.totalKpi).toBe(7.2)

        // Người đóng góp 50% -> 40 * 50% = 20 điểm hỗ trợ
        const resultSupport50 = calculateAssigneeTaskStandardKpi({
            userPositions: 6.0,
            diffMultiplier: 1.0,
            taskType: 'secondary',
            sharePercent: 50,
            taskStatus: 'completed',
        })
        expect(resultSupport50.bonusOverTargetPoints).toBe(20)
        expect(resultSupport50.totalKpi).toBe(20)

        // Case 7: Kiểm tra ngưỡng xếp loại mới chuẩn 100đ
        // Đạt 100đ trở lên -> Xuất sắc (A+)
        const resultScore100 = calculateAssigneeTaskStandardKpi({
            userPositions: 10,
            diffMultiplier: 1.0,
            progressPercent: 100,
            ratingStars: 5,
            taskStatus: 'completed',
            bonusPoints: 0,
        })
        expect(resultScore100.totalKpi).toBe(100)
        expect(resultScore100.grade).toBe('A+')
        expect(resultScore100.gradeLabel).toBe('Xuất sắc (A+)')

        // Dưới 70đ -> Cần cải thiện (C)
        const resultScoreLow = calculateAssigneeTaskStandardKpi({
            userPositions: 1,
            diffMultiplier: 1.0,
            progressPercent: 50,
            ratingStars: 1,
            taskStatus: 'partial',
            customProductivityScore: 20,
            customQualityScore: 5,
        })
        expect(resultScoreLow.totalKpi).toBe(60) // 20 + 5 + 20 + 15 = 60đ
        expect(resultScoreLow.grade).toBe('C')
        expect(resultScoreLow.gradeLabel).toBe('Cần cải thiện (C)')
    })

    it('calculates work speed correctly with regular hours (8h) and overtime hours (OT)', () => {
        // Standard shift: 8h, 100 positions, 60,000 kg (60 tons)
        const speedStandard = calculateWorkSpeed({
            positions: 100,
            weightKg: 60000,
            regularHours: 8,
            overtimeHours: 0,
        })
        expect(speedStandard.totalHours).toBe(8)
        expect(speedStandard.positionsPerHour).toBe(12.5) // 100 / 8
        expect(speedStandard.weightTonsPerHour).toBe(7.5) // 60 / 8
        expect(speedStandard.speedSummaryText).toContain('12.5 vt/h')
        expect(speedStandard.speedSummaryText).toContain('7.5 tấn/h')

        // Shift with overtime: 8h regular + 2h OT = 10h, 105.3 positions
        const speedWithOt = calculateWorkSpeed({
            positions: 105.3,
            weightKg: 60900,
            regularHours: 8,
            overtimeHours: 2,
        })
        expect(speedWithOt.totalHours).toBe(10)
        expect(speedWithOt.positionsPerHour).toBe(10.5) // 105.3 / 10 = 10.53 -> 10.5
        expect(speedWithOt.weightTonsPerHour).toBe(6.1) // 60.9 / 10 = 6.09 -> 6.1
        expect(speedWithOt.speedSummaryText).toBe('10.5 vt/h • 6.1 tấn/h')

        // Job without positions (e.g. only packages): 50 packages, 4 hours
        const speedPkgs = calculateWorkSpeed({
            packages: 100,
            regularHours: 4,
            overtimeHours: 0,
        })
        expect(speedPkgs.totalHours).toBe(4)
        expect(speedPkgs.packagesPerHour).toBe(25) // 100 / 4
        expect(speedPkgs.speedSummaryText).toBe('25 thùng/h')
    })
})

