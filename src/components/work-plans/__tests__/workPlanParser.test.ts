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
    getStatisticsDocumentCounts,
    getEvaluationHours,
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
        // Phiếu nhập/xuất kế toán không có LOT thật → chỉ cộng LOT từ nguồn có dữ liệu thật
        expect(recalculated.lots_count).toBe(17)
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
        // Test 4 mốc độ nặng công việc theo khối lượng:
        // Nhẹ 35đ (Tổng ca 90đ) • Vừa 37đ • Nặng 40đ • Rất nặng 45đ (trần trụ cột 45đ)
        const resLight = calculateAssigneeTaskStandardKpi({ userPositions: 0, difficulty: 'light', taskStatus: 'completed' })
        expect(resLight.productivityScore).toBe(35)

        const resMedium = calculateAssigneeTaskStandardKpi({ userPositions: 0, difficulty: 'medium', taskStatus: 'completed' })
        expect(resMedium.productivityScore).toBe(37)

        const resHeavy = calculateAssigneeTaskStandardKpi({ userPositions: 0, difficulty: 'heavy', taskStatus: 'completed' })
        expect(resHeavy.productivityScore).toBe(40)

        const resVeryHeavy = calculateAssigneeTaskStandardKpi({ userPositions: 0, difficulty: 'very_heavy', taskStatus: 'completed' })
        expect(resVeryHeavy.productivityScore).toBe(45)

        // Case 1: Công việc mức Nặng (heavy), làm 2 ngày, ngày 1 mới "Một phần" (progressPercent = 60%)
        // Năng suất vẫn đạt trọn vẹn 40đ theo độ nặng, nhưng Chất lượng bị trừ theo 40% việc còn tồn
        // (20đ × 40% = 8đ) vì việc chưa giải quyết xong trong ngày.
        const resultDay1 = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'heavy',
            diffMultiplier: 1.5,
            progressPercent: 60,
            ratingStars: 4, // sao chỉ tham khảo, không trừ điểm chất lượng
            taskStatus: 'partial',
        })
        expect(resultDay1.productivityScore).toBe(40)
        expect(resultDay1.qualityScore).toBe(12) // 20 - 8 (tự trừ 40% việc còn lại)
        expect(resultDay1.totalKpi).toBe(87) // 40 + 12 + 20 + 15 = 87đ (Hạng A)
        expect(resultDay1.grade).toBe('A')

        // Case 2: Quản lý ghi lỗi "Chưa xong việc trong ca" (-5đ) -> trừ Chất lượng đúng mức phạt,
        // KHÔNG tự trừ thêm theo % còn lại (không cộng dồn), Kỷ luật giữ nguyên 15đ
        const resultWithDelayIncident = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'heavy',
            diffMultiplier: 1.5,
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
        expect(resultWithDelayIncident.qualityScore).toBe(15) // 20 - 5, không trừ tự động thêm
        expect(resultWithDelayIncident.disciplineScore).toBe(15) // không trừ trùng vào Kỷ luật
        expect(resultWithDelayIncident.totalKpi).toBe(90) // 40 + 15 + 20 + 15 = 90đ (Hạng A)

        // Case 2b: Lỗi hàng hóa (rách tem -10) trừ thẳng vào Chất lượng, KHÔNG trừ trùng vào An toàn
        const resultWithGoodsIncident = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'heavy',
            diffMultiplier: 1.5,
            progressPercent: 100,
            taskStatus: 'completed',
            incidents: [
                {
                    id: 'inc_goods',
                    type: 'torn_label',
                    name: 'Làm mờ, rách tem / Mất mã barcode kiện hàng',
                    group: 'quality_goods',
                    severity: 'minor',
                    penalty_points: 10,
                },
            ],
        })
        expect(resultWithGoodsIncident.qualityScore).toBe(10) // 20 - 10
        expect(resultWithGoodsIncident.safetyScore).toBe(20) // không trừ lần 2
        expect(resultWithGoodsIncident.totalKpi).toBe(85) // 40 + 10 + 20 + 15

        // Case 3: Task bị cancelled -> Năng suất và KPI = 0
        const resultCancelled = calculateAssigneeTaskStandardKpi({
            userPositions: 45,
            difficulty: 'heavy',
            diffMultiplier: 1.5,
            taskStatus: 'cancelled',
        })
        expect(resultCancelled.productivityScore).toBe(0)
        expect(resultCancelled.totalKpi).toBe(0)

        // Case 4: Công việc nhóm chia tỷ lệ, độ nặng Rất nặng (very_heavy), 5 sao
        const resultGroupMember = calculateAssigneeTaskStandardKpi({
            userPositions: 4.6,
            difficulty: 'very_heavy',
            diffMultiplier: 2.0,
            progressPercent: 100,
            ratingStars: 5, // 5 sao = 20đ
            taskStatus: 'completed',
        })
        expect(resultGroupMember.productivityScore).toBe(45)
        expect(resultGroupMember.qualityScore).toBe(20)
        expect(resultGroupMember.totalKpi).toBe(100) // 45 + 20 + 20 + 15 = 100đ (Hạng A+ - Xuất sắc)
        expect(resultGroupMember.grade).toBe('A+')
        expect(resultGroupMember.gradeLabel).toBe('🌸 Bé Khỏe Bé Ngoan (A+)')

        // Case 5: Quản lý tự chấm tay (override) điểm Năng suất và Chất lượng cho riêng từng nhân viên
        const resultCustomScores = calculateAssigneeTaskStandardKpi({
            userPositions: 4.6,
            difficulty: 'heavy',
            diffMultiplier: 1.5,
            progressPercent: 60,
            ratingStars: 3, // sao tham khảo, không quyết định điểm chất lượng
            taskStatus: 'partial',
            customProductivityScore: 38, // Chấm tay năng suất 38
            customQualityScore: 20, // Riêng người này làm rất đẹp, chấm tay 20/20
        })
        expect(resultCustomScores.productivityScore).toBe(38)
        expect(resultCustomScores.qualityScore).toBe(20)
        expect(resultCustomScores.totalKpi).toBe(93) // 38 + 20 + 20 + 15 = 93đ (Hạng A)
        expect(resultCustomScores.grade).toBe('A')

        // Case 6: Việc phụ / hỗ trợ ngoài ca -> Điểm hỗ trợ tự động tỷ lệ thuận theo % đóng góp
        // Việc phụ mức Nặng (40đ), người đóng góp 18% -> 40 * 18% = 7.2 điểm hỗ trợ
        const resultSupport18 = calculateAssigneeTaskStandardKpi({
            userPositions: 2.2,
            difficulty: 'heavy',
            diffMultiplier: 1.5,
            taskType: 'secondary',
            sharePercent: 18,
            taskStatus: 'completed',
        })
        expect(resultSupport18.bonusOverTargetPoints).toBe(7.2)
        expect(resultSupport18.totalKpi).toBe(7.2)

        // Việc phụ mức Vừa (37đ), người đóng góp 50% -> 37 * 50% = 18.5 điểm hỗ trợ
        const resultSupport50 = calculateAssigneeTaskStandardKpi({
            userPositions: 6.0,
            difficulty: 'medium',
            diffMultiplier: 1.2,
            taskType: 'secondary',
            sharePercent: 50,
            taskStatus: 'completed',
        })
        expect(resultSupport50.bonusOverTargetPoints).toBe(18.5)
        expect(resultSupport50.totalKpi).toBe(18.5)

        // Case 7: Kiểm tra ngưỡng xếp loại mới chuẩn 100đ
        // Đạt 100đ trở lên -> Xuất sắc (A+) — dùng mức Rất nặng 45đ
        const resultScore100 = calculateAssigneeTaskStandardKpi({
            userPositions: 10,
            difficulty: 'very_heavy',
            diffMultiplier: 2.0,
            progressPercent: 100,
            ratingStars: 5,
            taskStatus: 'completed',
            bonusPoints: 0,
        })
        expect(resultScore100.totalKpi).toBe(100)
        expect(resultScore100.grade).toBe('A+')
        expect(resultScore100.gradeLabel).toBe('🌸 Bé Khỏe Bé Ngoan (A+)')

        // Dưới 70đ -> Cần cải thiện (C)
        const resultScoreLow = calculateAssigneeTaskStandardKpi({
            userPositions: 1,
            difficulty: 'light',
            diffMultiplier: 1.0,
            progressPercent: 50,
            ratingStars: 1, // 1 sao = 4đ
            taskStatus: 'partial',
            customProductivityScore: 20,
            customQualityScore: 4,
        })
        expect(resultScoreLow.totalKpi).toBe(59) // 20 + 4 + 20 + 15 = 59đ
        expect(resultScoreLow.grade).toBe('C')
        expect(resultScoreLow.gradeLabel).toBe('⚠️ Chưa Ngoan (C)')
    })

    it('uses the statistics scale (Năng suất 30-40đ trên trần 40đ, không có An toàn, Chất lượng 40đ, Kỷ luật 20đ) for statistics work', () => {
        // Việc nhẹ, số liệu đúng tuyệt đối: sao nghiệm thu KHÔNG ảnh hưởng chất lượng
        const light = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            progressPercent: 100,
            ratingStars: 4,
            taskStatus: 'completed',
            workNature: 'statistics',
        })
        expect(light.productivityMax).toBe(40) // trần trụ cột 40đ (đã gồm 20đ của An toàn)
        expect(light.qualityMax).toBe(40)
        expect(light.safetyMax).toBe(0) // không vận hành xe nâng -> không có trụ An toàn
        expect(light.safetyScore).toBe(0)
        expect(light.disciplineMax).toBe(20)
        expect(light.productivityScore).toBe(30) // Nhẹ đạt mốc 30/40
        expect(light.qualityScore).toBe(40) // đúng số liệu = tuyệt đối, không phụ thuộc sao
        expect(light.totalKpi).toBe(90) // 30 + 40 + 20 — bằng ngày lao động mức Nhẹ
        expect(light.grade).toBe('A')

        // Việc nặng = mốc 35/40 năng suất, cân bằng với ngày công lao động
        const heavy = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'heavy',
            progressPercent: 100,
            taskStatus: 'completed',
            workNature: 'statistics',
        })
        expect(heavy.productivityMax).toBe(40)
        expect(heavy.productivityScore).toBe(35)
        expect(heavy.totalKpi).toBe(95)

        const veryHeavy = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'very_heavy',
            progressPercent: 100,
            taskStatus: 'completed',
            workNature: 'statistics',
        })
        expect(veryHeavy.productivityMax).toBe(40)
        expect(veryHeavy.productivityScore).toBe(40)
        expect(veryHeavy.totalKpi).toBe(100)

        // Hoàn thành 50% -> năng suất nhân theo % hoàn thành, Chất lượng cũng tự trừ 50% việc còn lại
        const halfDone = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            progressPercent: 50,
            ratingStars: 5,
            taskStatus: 'partial',
            workNature: 'statistics',
        })
        expect(halfDone.productivityScore).toBe(15) // 30 × 50%
        expect(halfDone.qualityScore).toBe(20) // 40 - 20 (50% việc còn tồn)
        expect(halfDone.totalKpi).toBe(55) // 15 + 20 + 20
        expect(halfDone.grade).toBe('C')

        // Sai số liệu: trừ thẳng vào Chất lượng, KHÔNG trừ trùng vào Kỷ luật
        const dataError = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'heavy',
            progressPercent: 100,
            taskStatus: 'completed',
            workNature: 'statistics',
            incidents: [
                { id: '1', type: 'wrong_quantity_count', name: 'Ghi sai số lượng', group: 'inventory_statistics', severity: 'moderate', penalty_points: 15 },
            ],
        })
        expect(dataError.qualityScore).toBe(25) // 40 - 15
        expect(dataError.disciplineScore).toBe(20) // không bị trừ lần 2
        expect(dataError.totalKpi).toBe(80) // 35 + 25 + 20
        expect(dataError.grade).toBe('B')

        // Sai LOT là lỗi nghiêm trọng -> khóa hạng A
        const severeDataError = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'heavy',
            progressPercent: 100,
            taskStatus: 'completed',
            workNature: 'statistics',
            incidents: [
                { id: '2', type: 'wrong_lot_code', name: 'Ghi sai mã LOT', group: 'inventory_statistics', severity: 'severe', penalty_points: 25 },
            ],
        })
        expect(severeDataError.qualityScore).toBe(15)
        expect(severeDataError.hasSevereIncident).toBe(true)
        expect(severeDataError.grade).toBe('C')

        // Lỗi xe nâng hiếm gặp trên việc thống kê (bản ghi cũ) -> trừ Kỷ luật, không có trụ An toàn
        const statsForkliftError = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            progressPercent: 100,
            taskStatus: 'completed',
            workNature: 'statistics',
            incidents: [
                { id: '3', type: 'no_horn', name: 'Không bấm còi', group: 'safety_forklift', severity: 'minor', penalty_points: 5 },
            ],
        })
        expect(statsForkliftError.safetyMax).toBe(0)
        expect(statsForkliftError.safetyScore).toBe(0)
        expect(statsForkliftError.disciplineScore).toBe(15) // 20 - 5
        expect(statsForkliftError.totalKpi).toBe(85) // 30 + 40 + 15

        // Lao động giữ nguyên thang cũ
        const labor = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'medium',
            progressPercent: 100,
            ratingStars: 4,
            taskStatus: 'completed',
            workNature: 'labor',
        })
        expect(labor.productivityScore).toBe(37)
        expect(labor.productivityMax).toBe(45)
        expect(labor.qualityMax).toBe(20)
        expect(labor.qualityScore).toBe(20) // chất lượng tuyệt đối, sao chỉ tham khảo
        expect(labor.disciplineMax).toBe(15)
        expect(labor.totalKpi).toBe(92) // 37 + 20 + 20 + 15 — bằng đúng tổng ngày Thống kê mức Vừa
    })

    it('deducts the Quality pillar proportionally when work is left pending during the day (both work natures)', () => {
        // Lao động: việc nặng, mới xong 70% -> Chất lượng còn 30% trụ = 20 - 6 = 14đ
        const laborPending = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'heavy',
            progressPercent: 70,
            taskStatus: 'partial',
            workNature: 'labor',
        })
        expect(laborPending.qualityMax).toBe(20)
        expect(laborPending.qualityScore).toBe(14)
        expect(laborPending.totalKpi).toBe(89) // 40 + 14 + 20 + 15

        // Thống kê: việc nặng, xong 70% -> Chất lượng còn 30% của 40đ = 28đ
        const statsPending = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'heavy',
            progressPercent: 70,
            taskStatus: 'partial',
            workNature: 'statistics',
        })
        expect(statsPending.qualityMax).toBe(40)
        expect(statsPending.qualityScore).toBe(28)
        expect(statsPending.totalKpi).toBe(72.5) // 35×70% = 24.5 + 28 + 20

        // Hoàn thành 100% mới được trọn trụ Chất lượng
        const statsCompleted = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'heavy',
            progressPercent: 100,
            taskStatus: 'completed',
            workNature: 'statistics',
        })
        expect(statsCompleted.qualityScore).toBe(40)

        // Chưa làm gì trong ngày (uncompleted, 0%) -> mất trọn trụ Chất lượng
        const laborUntouched = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'medium',
            progressPercent: 0,
            taskStatus: 'uncompleted',
            workNature: 'labor',
        })
        expect(laborUntouched.qualityScore).toBe(0)

        // Quản lý chấm tay Chất lượng -> quyền chấm tay quyết định, không tự trừ
        const customQuality = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'medium',
            progressPercent: 40,
            taskStatus: 'partial',
            workNature: 'labor',
            customQualityScore: 18,
        })
        expect(customQuality.qualityScore).toBe(18)

        // Lỗi hàng hóa + việc tồn đọng cùng lúc -> trừ cả hai trên trụ Chất lượng (không âm)
        const goodsAndPending = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'medium',
            progressPercent: 50,
            taskStatus: 'partial',
            workNature: 'labor',
            incidents: [
                { id: 'g1', type: 'torn_label', name: 'Rách tem', group: 'quality_goods', severity: 'minor', penalty_points: 10 },
            ],
        })
        expect(goodsAndPending.qualityScore).toBe(0) // 20 - 10 - 10 = 0
        expect(goodsAndPending.safetyScore).toBe(20)
        expect(goodsAndPending.disciplineScore).toBe(15)
    })

    it('derives statistics document/row counts from linked accounting orders when nothing is stored yet', () => {
        const inboundOrder = (
            id: string,
            code: string,
            items_count: number
        ) => ({
            id,
            code,
            order_kind: 'inbound' as const,
            status: 'completed',
            items_count,
            total_quantity: items_count,
            unit: 'thùng',
        })
        const outboundOrder = (
            id: string,
            code: string,
            items_count: number
        ) => ({
            ...inboundOrder(id, code, items_count),
            order_kind: 'outbound' as const,
        })
        const legacyMetrics = {
            linked_inbound_orders: [
                inboundOrder('i1', '0026/1126/A', 2),
                inboundOrder('i2', '0025/1126/A', 3),
            ],
            linked_outbound_orders: [outboundOrder('o1', '0042/1126/B', 1)],
        }
        expect(getStatisticsDocumentCounts(legacyMetrics)).toEqual({
            documents: 3,
            rows: 6,
        })

        // Số đã lưu (kể cả nhập tay) luôn được ưu tiên
        expect(
            getStatisticsDocumentCounts({
                ...legacyMetrics,
                documents_count: 10,
                data_rows_count: 50,
            })
        ).toEqual({ documents: 10, rows: 50 })

        expect(getStatisticsDocumentCounts(null)).toEqual({ documents: 0, rows: 0 })

        // Tóm tắt số liệu của việc thống kê cũng suy ra từ phiếu đã gắn
        const summary = formatWorkloadSummaryText(legacyMetrics, 'statistics')
        expect(summary).toContain('3 phiếu đã tạo')
        expect(summary).toContain('6 dòng dữ liệu')

        // Việc lao động giữ nguyên: không tự hiển thị số phiếu suy ra
        expect(formatWorkloadSummaryText(legacyMetrics, 'labor')).not.toContain('phiếu đã tạo')
    })

    it('sums work hours from assignee evaluations and treats missing hours as the 8h standard shift', () => {
        expect(getEvaluationHours(null)).toEqual({
            regular: 0,
            overtime: 0,
            total: 0,
            hasData: false,
            isDefault: false,
        })

        const evaluated = getEvaluationHours({
            assignee_evaluations: [
                { assignee_name: 'Giang', share_percent: 100, regular_hours: 8, overtime_hours: 2 },
                { assignee_name: 'Da Ti', share_percent: 100, regular_hours: 6 },
            ],
        })
        expect(evaluated).toEqual({
            regular: 14,
            overtime: 2,
            total: 16,
            hasData: true,
            isDefault: false,
        })

        // Đánh giá cũ chưa lưu giờ -> hiểu là ca chuẩn 8h, OT 0h
        const legacy = getEvaluationHours({
            assignee_evaluations: [{ assignee_name: 'Trôi', share_percent: 100 }],
        })
        expect(legacy).toEqual({
            regular: 8,
            overtime: 0,
            total: 8,
            hasData: true,
            isDefault: false,
        })

        // Đã đánh giá nhưng chưa lưu giờ từng người -> tạm tính ca chuẩn 8h/người
        expect(
            getEvaluationHours(null, { assigneeCount: 2, assumeStandardShift: true })
        ).toEqual({ regular: 16, overtime: 0, total: 16, hasData: true, isDefault: true })

        // Chưa đánh giá (giao việc) -> không có giờ
        expect(
            getEvaluationHours(null, { assigneeCount: 2, assumeStandardShift: false })
        ).toEqual({ regular: 0, overtime: 0, total: 0, hasData: false, isDefault: false })
    })

    it('applies each incident group only to its own work nature and routes mismatches to discipline', () => {
        // Lao động không có việc ghi chép/số liệu: nếu lỡ ghi nhận thì trừ Kỷ luật, không trừ Chất lượng
        const laborDataError = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'medium',
            progressPercent: 100,
            taskStatus: 'completed',
            workNature: 'labor',
            incidents: [
                { id: '1', type: 'wrong_quantity_count', name: 'Ghi sai số lượng', group: 'inventory_statistics', severity: 'moderate', penalty_points: 15 },
            ],
        })
        expect(laborDataError.qualityScore).toBe(20) // Chất lượng lao động chỉ nhận lỗi hàng hóa
        expect(laborDataError.safetyScore).toBe(20)
        expect(laborDataError.disciplineScore).toBe(0) // 15 - 15
        expect(laborDataError.totalKpi).toBe(77) // 37 + 20 + 20 + 0

        // Thống kê + lỗi hàng hóa -> trừ Chất lượng (trước đây bị đẩy sang An toàn)
        const statsGoodsError = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'heavy',
            progressPercent: 100,
            taskStatus: 'completed',
            workNature: 'statistics',
            incidents: [
                { id: '2', type: 'torn_label', name: 'Rách tem', group: 'quality_goods', severity: 'minor', penalty_points: 10 },
            ],
        })
        expect(statsGoodsError.qualityScore).toBe(30) // 40 - 10
        expect(statsGoodsError.safetyMax).toBe(0) // thống kê không có trụ An toàn
        expect(statsGoodsError.safetyScore).toBe(0)
        expect(statsGoodsError.disciplineScore).toBe(20)
        expect(statsGoodsError.totalKpi).toBe(85) // 35 + 30 + 20

        // Lỗi ghi chép lưu dưới group cũ 'operations' trên việc lao động -> trừ Kỷ luật (không áp dụng cho tay chân)
        const legacyMissedScan = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'medium',
            progressPercent: 100,
            taskStatus: 'completed',
            workNature: 'labor',
            incidents: [
                { id: '3', type: 'missed_scan', name: 'Quên quét tem', group: 'operations', severity: 'minor', penalty_points: 10 },
            ],
        })
        expect(legacyMissedScan.qualityScore).toBe(20)
        expect(legacyMissedScan.disciplineScore).toBe(5) // 15 - 10
        expect(legacyMissedScan.totalKpi).toBe(82) // 37 + 20 + 20 + 5

        // Lỗi xe nâng trên việc lao động -> trừ An toàn (việc thống kê đã có case riêng ở trên)
        const forkliftError = calculateAssigneeTaskStandardKpi({
            userPositions: 0,
            difficulty: 'medium',
            progressPercent: 100,
            taskStatus: 'completed',
            workNature: 'labor',
            incidents: [
                { id: '4', type: 'no_horn', name: 'Không bấm còi', group: 'safety_forklift', severity: 'minor', penalty_points: 5 },
            ],
        })
        expect(forkliftError.safetyScore).toBe(15) // 20 - 5
        expect(forkliftError.qualityScore).toBe(20)
        expect(forkliftError.disciplineScore).toBe(15)
        expect(forkliftError.totalKpi).toBe(87) // 37 + 20 + 15 + 15
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

