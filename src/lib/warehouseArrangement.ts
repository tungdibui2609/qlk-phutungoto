import { Database } from './database.types'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']

export interface PositionWithZone extends Position {
    zone_id?: string | null
}

export interface CandidateLot {
    lotId: string
    lotCode: string
    quantity: number
    unit: string
    currentPositionId: string
    currentPositionCode: string
    currentZoneId?: string | null
    currentLocationName: string
    isHall: boolean
    priority: number // 1: Sảnh, 2: Dồn từ kệ khác, 3: Vị trí khác
    priorityLabel: string
}

export interface FloorSuggestion {
    key: string // Unique key: `${binId}-${levelId}`
    warehouseId?: string | null
    warehouseName: string
    aisleName: string
    binId: string
    binName: string
    binCode?: string | null
    levelId: string
    levelName: string
    floorNumber: number
    totalPositions: number
    occupiedCount: number
    emptyCount: number
    emptyPositions: PositionWithZone[]
    dominantProduct: {
        productId: string
        productName: string
        sku: string
        internalCode?: string
        internalName?: string
        productColor?: string | null
        unit: string
        quantityPerPallet?: number | null
        palletUnit?: string | null
        inferredQuantityPerPallet?: number | null
        inferredSampleCount?: number
        occupiedPositionsCount: number
        percentage: number
    }
    candidateLots: CandidateLot[]
}

/**
 * Trích xuất số tầng từ tên tầng hoặc mã vị trí
 * Ví dụ: "TẦNG 2" -> 2, "K1D1A02T202" -> 2
 */
export function parseFloorNumber(levelName?: string | null, samplePositionCode?: string | null): number {
    if (levelName) {
        const match = levelName.match(/(?:tầng|floor|t|f)\s*(\d+)/i)
        if (match) {
            const num = parseInt(match[1], 10)
            if (!isNaN(num) && num > 0) return num
        }
    }
    if (samplePositionCode) {
        // Ví dụ: K1D1A02T202 -> T2 là tầng, 02 là vị trí
        const matchT = samplePositionCode.match(/T(\d+?)(\d{2})$/i)
        if (matchT) {
            const num = parseInt(matchT[1], 10)
            if (!isNaN(num) && num > 0) return num
        }
        const matchAnyT = samplePositionCode.match(/T(\d+)/i)
        if (matchAnyT) {
            const num = parseInt(matchAnyT[1], 10)
            if (!isNaN(num) && num > 0) return num
        }
    }
    return 1
}

/**
 * Phân tích danh sách vị trí để tìm ra các Ô - Tầng có vị trí trống
 * và các vị trí còn lại đang chứa cùng 1 loại sản phẩm (sản phẩm chủ đạo).
 * Sau đó tìm kiếm các lô hàng cùng loại trong toàn kho để gợi ý lấp đầy.
 */
export function analyzeWarehouseArrangements(
    allPositions: PositionWithZone[],
    zones: Zone[],
    lotInfo: Record<string, any>,
    isHallZoneId: (zoneId?: string | null) => boolean
): FloorSuggestion[] {
    if (!allPositions || allPositions.length === 0 || !zones || zones.length === 0) {
        return []
    }

    // 1. Tạo lookup map cho zones
    const zoneMap = new Map<string, Zone>()
    zones.forEach(z => zoneMap.set(z.id, z))

    // Helper tìm chuỗi phả hệ của 1 zone (Level -> Bin -> Aisle -> Warehouse)
    const getZoneHierarchy = (zoneId?: string | null) => {
        let curr = zoneId ? zoneMap.get(zoneId) : null
        let levelName = curr?.name || 'Không rõ tầng'
        let binName = ''
        let binId = ''
        let binCode = ''
        let aisleName = ''
        let warehouseName = ''
        let warehouseId: string | null = null

        if (curr?.parent_id) {
            const bin = zoneMap.get(curr.parent_id)
            if (bin) {
                binName = bin.name || ''
                binId = bin.id
                binCode = bin.code || ''
                if (bin.parent_id) {
                    const aisle = zoneMap.get(bin.parent_id)
                    if (aisle) {
                        aisleName = aisle.name || ''
                        if (aisle.parent_id) {
                            const wh = zoneMap.get(aisle.parent_id)
                            if (wh) {
                                warehouseName = wh.name || ''
                                warehouseId = wh.id
                            }
                        }
                    }
                }
            }
        }

        return { levelName, binName, binId, binCode, aisleName, warehouseName, warehouseId }
    }

    // 2. Nhóm các positions theo `zone_id` (chính là Level / Tầng)
    const positionsByLevel = new Map<string, PositionWithZone[]>()
    allPositions.forEach(p => {
        const zid = p.zone_id || 'unknown'
        if (!positionsByLevel.has(zid)) {
            positionsByLevel.set(zid, [])
        }
        positionsByLevel.get(zid)!.push(p)
    })

    // 3. Xây dựng index tra cứu nhanh tất cả các lô hàng theo product_id / sku
    // Map: productId -> Array<{ lotId, lotCode, pos, item, isHall }>
    const lotsByProduct = new Map<string, Array<{
        lotId: string
        lotCode: string
        position: PositionWithZone
        item: any
        isHall: boolean
    }>>()

    allPositions.forEach(pos => {
        if (!pos.lot_id) return
        const lot = lotInfo[pos.lot_id]
        if (!lot || !lot.items || !Array.isArray(lot.items)) return

        const isHall = isHallZoneId(pos.zone_id)

        lot.items.forEach((item: any) => {
            const prodKey = item.product_id || item.sku
            if (!prodKey) return

            if (!lotsByProduct.has(prodKey)) {
                lotsByProduct.set(prodKey, [])
            }
            lotsByProduct.get(prodKey)!.push({
                lotId: pos.lot_id!,
                lotCode: lot.code,
                position: pos,
                item,
                isHall
            })
        })
    })

    const suggestions: FloorSuggestion[] = []

    // 4. Duyệt qua từng tầng để tìm các tầng cần gợi ý lấp đầy
    positionsByLevel.forEach((levelPositions, levelId) => {
        if (levelId === 'unknown') return
        const levelZone = zoneMap.get(levelId)
        if (!levelZone) return

        // Bỏ qua nếu chính zone này là Sảnh (Sảnh là nơi tập kết tự do, không có quy tắc 1 ô 1 loại hàng)
        if (isHallZoneId(levelId)) return

        // Đếm vị trí trống và vị trí có hàng
        const emptyPositions = levelPositions.filter(p => !p.lot_id)
        const occupiedPositions = levelPositions.filter(p => !!p.lot_id)

        // Điều kiện 1: Tầng phải có ít nhất 1 vị trí trống và ít nhất 1 vị trí đã có hàng
        // Và tổng số vị trí trên tầng >= 2 (ví dụ 6 vị trí như hình)
        if (emptyPositions.length === 0 || occupiedPositions.length === 0 || levelPositions.length < 2) {
            return
        }

        // Đếm tần suất sản phẩm của các vị trí có hàng
        const productCounts = new Map<string, { count: number, item: any }>()
        occupiedPositions.forEach(p => {
            const lot = lotInfo[p.lot_id!]
            if (lot && lot.items && lot.items.length > 0) {
                // Ưu tiên item đầu tiên nếu 1 vị trí chỉ có 1 sản phẩm chính
                const item = lot.items[0]
                const prodKey = item.product_id || item.sku
                if (prodKey) {
                    const curr = productCounts.get(prodKey) || { count: 0, item }
                    curr.count += 1
                    productCounts.set(prodKey, curr)
                }
            }
        })

        if (productCounts.size === 0) return

        // Tìm sản phẩm xuất hiện nhiều nhất (Dominant Product)
        let dominantKey = ''
        let maxCount = 0
        let dominantItem: any = null

        productCounts.forEach((data, prodKey) => {
            if (data.count > maxCount) {
                maxCount = data.count
                dominantKey = prodKey
                dominantItem = data.item
            }
        })

        // Tỷ lệ chiếm giữ của sản phẩm này trên các vị trí ĐÃ CÓ HÀNG
        const dominantRatio = maxCount / occupiedPositions.length

        // Điều kiện 2: Sản phẩm chủ đạo phải chiếm >= 50% số vị trí đã có hàng
        // (Trong thực tế như ảnh của người dùng là 5/5 vị trí có hàng = 100%)
        if (dominantRatio < 0.5 || !dominantItem) return

        // Thu thập số lượng thùng thực tế từ các vị trí ĐÃ CÓ HÀNG của sản phẩm này trên tầng
        const occupiedLotQuantities: number[] = []
        occupiedPositions.forEach(p => {
            const lot = lotInfo[p.lot_id!]
            if (lot) {
                let matchedItem = lot.items?.find((it: any) => (it.product_id || it.sku) === dominantKey)
                if (!matchedItem && lot.items && lot.items.length > 0) {
                    matchedItem = lot.items[0]
                }
                const rawQty = matchedItem?.quantity ?? lot.quantity
                const num = Number(rawQty)
                if (!isNaN(num) && num > 0) {
                    occupiedLotQuantities.push(Math.round(num))
                }
            }
        })

        // Tự động suy ra quy cách 1 pallet = bao nhiêu thùng (dựa vào số lượng xuất hiện phổ biến nhất trên tầng)
        let inferredQuantityPerPallet: number | null = null
        if (occupiedLotQuantities.length > 0) {
            const freq = new Map<number, number>()
            let maxF = 0
            let bestQty = occupiedLotQuantities[0]
            occupiedLotQuantities.forEach(q => {
                const c = (freq.get(q) || 0) + 1
                freq.set(q, c)
                if (c > maxF) {
                    maxF = c
                    bestQty = q
                }
            })
            inferredQuantityPerPallet = bestQty
        }

        // 5. Tìm các lô hàng ứng viên cùng loại trong kho để đưa vào
        const allMatchingLots = lotsByProduct.get(dominantKey) || []
        const currentLevelPositionIds = new Set(levelPositions.map(p => p.id))

        // Lọc bỏ những lô đã nằm sẵn trên chính tầng này
        const eligibleLots = allMatchingLots.filter(candidate => {
            return !currentLevelPositionIds.has(candidate.position.id)
        })

        // Sắp xếp ưu tiên:
        // 1: Đang ở Sảnh (chờ xếp) -> Ưu tiên cao nhất
        // 2: Đang ở vị trí lẻ khác
        // 3: Vị trí khác
        const candidates: CandidateLot[] = eligibleLots.map(c => {
            let priority = 3
            let priorityLabel = 'Vị trí khác'

            if (c.isHall) {
                priority = 1
                priorityLabel = 'Đang ở Sảnh'
            } else {
                priority = 2
                priorityLabel = 'Dồn từ kệ khác'
            }

            const cZone = zoneMap.get(c.position.zone_id || '')
            const locName = c.isHall
                ? (cZone?.name || 'Sảnh chờ')
                : `${cZone?.name || ''} (${c.position.code})`

            return {
                lotId: c.lotId,
                lotCode: c.lotCode,
                quantity: c.item.quantity,
                unit: c.item.unit || '',
                currentPositionId: c.position.id,
                currentPositionCode: c.position.code,
                currentZoneId: c.position.zone_id,
                currentLocationName: locName,
                isHall: c.isHall,
                priority,
                priorityLabel
            }
        }).sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority
            return a.currentPositionCode.localeCompare(b.currentPositionCode)
        })

        // Thu thập thông tin phả hệ của tầng này
        const hierarchy = getZoneHierarchy(levelId)
        const sampleCode = levelPositions[0]?.code || emptyPositions[0]?.code
        const floorNumber = parseFloorNumber(levelZone.name, sampleCode)

        suggestions.push({
            key: `${hierarchy.binId || levelId}-${levelId}`,
            warehouseId: hierarchy.warehouseId,
            warehouseName: hierarchy.warehouseName || 'Kho',
            aisleName: hierarchy.aisleName || 'Dãy',
            binId: hierarchy.binId || levelId,
            binName: hierarchy.binName || levelZone.name,
            binCode: hierarchy.binCode,
            levelId: levelId,
            levelName: levelZone.name,
            floorNumber,
            totalPositions: levelPositions.length,
            occupiedCount: occupiedPositions.length,
            emptyCount: emptyPositions.length,
            emptyPositions: emptyPositions.sort((a, b) => (a.code || '').localeCompare(b.code || '')),
            dominantProduct: {
                productId: dominantItem.product_id,
                productName: dominantItem.product_name,
                sku: dominantItem.sku,
                internalCode: dominantItem.internal_code,
                internalName: dominantItem.internal_name,
                productColor: dominantItem.product_color,
                unit: dominantItem.unit || '',
                quantityPerPallet: dominantItem.quantity_per_pallet ?? null,
                palletUnit: dominantItem.pallet_unit ?? null,
                inferredQuantityPerPallet,
                inferredSampleCount: occupiedLotQuantities.length,
                occupiedPositionsCount: maxCount,
                percentage: Math.round(dominantRatio * 100)
            },
            candidateLots: candidates
        })
    })

    // Sắp xếp các gợi ý: Tầng có nhiều vị trí đã lấp nhất (ít ô trống cần bù nhất, ví dụ còn thiếu 1-2 ô) lên đầu
    return suggestions.sort((a, b) => {
        const aHasCandidates = a.candidateLots.length > 0 ? 1 : 0
        const bHasCandidates = b.candidateLots.length > 0 ? 1 : 0
        if (aHasCandidates !== bHasCandidates) return bHasCandidates - aHasCandidates

        if (a.emptyCount !== b.emptyCount) return a.emptyCount - b.emptyCount

        return a.binName.localeCompare(b.binName, undefined, { numeric: true })
    })
}
