import { describe, it, expect } from 'vitest'
import { buildProductSummaries, FluctuationEvent } from '../lotDailyFluctuation'

describe('buildProductSummaries', () => {
    it('aggregates daily create, adjust_up (+2), adjust_down (-3), export, and delete into netDelta', () => {
        const events: FluctuationEvent[] = [
            {
                id: '1',
                timestamp: '2026-11-14T08:00:00Z',
                sortTime: 1,
                category: 'create',
                lotId: 'lot-1',
                lotCode: 'DL-001',
                dailySeq: 1,
                positions: ['A1'],
                performedBy: null,
                title: 'Tạo LOT mới',
                description: '',
                deltas: [{ productId: 'p1', sku: 'SKU1', name: 'Xoài', unit: 'Thùng', oldQty: 0, newQty: 10, deltaQty: 10 }]
            },
            {
                id: '2',
                timestamp: '2026-11-14T09:00:00Z',
                sortTime: 2,
                category: 'adjust_up',
                lotId: 'lot-1',
                lotCode: 'DL-001',
                dailySeq: 1,
                positions: ['A1'],
                performedBy: null,
                title: 'Bỏ thêm',
                description: '',
                deltas: [{ productId: 'p1', sku: 'SKU1', name: 'Xoài', unit: 'Thùng', oldQty: 10, newQty: 12, deltaQty: 2 }]
            },
            {
                id: '3',
                timestamp: '2026-11-14T10:00:00Z',
                sortTime: 3,
                category: 'adjust_down',
                lotId: 'lot-2',
                lotCode: 'DL-002',
                dailySeq: 2,
                positions: ['B2'],
                performedBy: null,
                title: 'Bớt ra',
                description: '',
                deltas: [{ productId: 'p1', sku: 'SKU1', name: 'Xoài', unit: 'Thùng', oldQty: 8, newQty: 5, deltaQty: -3 }]
            },
            {
                id: '4',
                timestamp: '2026-11-14T11:00:00Z',
                sortTime: 4,
                category: 'export',
                lotId: 'lot-3',
                lotCode: 'DL-003',
                dailySeq: 3,
                positions: ['C1'],
                performedBy: null,
                title: 'Xuất bán',
                description: '',
                deltas: [{ productId: 'p1', sku: 'SKU1', name: 'Xoài', unit: 'Thùng', oldQty: 4, newQty: 0, deltaQty: -4 }]
            },
            {
                id: '5',
                timestamp: '2026-11-14T12:00:00Z',
                sortTime: 5,
                category: 'delete',
                lotId: 'lot-4',
                lotCode: 'DL-004',
                dailySeq: 4,
                positions: ['D1'],
                performedBy: null,
                title: 'Xóa LOT',
                description: '',
                deltas: [{ productId: 'p1', sku: 'SKU1', name: 'Xoài', unit: 'Thùng', oldQty: 2, newQty: 0, deltaQty: -2 }]
            }
        ]

        const result = buildProductSummaries(events)
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
            productId: 'p1',
            sku: 'SKU1',
            createdQty: 10,
            adjustedUpQty: 2,
            adjustedDownQty: 3,
            exportedQty: 4,
            deletedQty: 2,
            netDelta: 3, // 10 + 2 - 3 - 4 - 2 = +3
            eventCount: 5
        })
    })
})
