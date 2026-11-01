// Thống kê "chi tiết theo danh mục" tính trên Ô VỊ TRÍ (không phải khối lượng KG):
// mỗi ô đang chứa LOT được gán cho danh mục của các dòng trong LOT đó.
// Công thức sao chép đúng trang /warehouses/status để Dashboard đối soát được 1:1:
//   TỈ LỆ HÀNG HOÁ  = số ô của danh mục / tổng ô ĐANG CHỨA HÀNG
//   TỈ LỆ CÔNG SUẤT = số ô của danh mục / tổng ô ĐƯỢC QUY HOẠCH (kể cả ô trống)
// Suy danh mục qua resolveCategories — quy tắc duy nhất của toàn hệ thống (dòng LOT thắng sản phẩm).

import { resolveCategories, type CategoryBearing } from './productCategory'

export interface CatStatZone {
    id: string
    parent_id?: string | null
    level?: number | null
}

export interface CatStatPosition {
    id: string
    lot_id?: string | null
    zone_id?: string | null
}

export interface CatStatLotItem {
    category_id?: string | null
    products?: (CategoryBearing & { sku?: string | null; name?: string | null }) | null
}

export interface CatStatLot {
    id: string
    lot_items?: CatStatLotItem[] | null
}

export interface CategoryPositionStat {
    categoryId: string
    name: string
    count: number
    pctOfOccupied: number
    pctOfTotal: number
}

export interface CategoryPositionResult {
    stats: CategoryPositionStat[]
    totalPositions: number
    occupiedPositions: number
    /** Ô đang chứa hàng nhưng LOT không mang danh mục nào (LOT legacy / chưa gán danh mục). */
    unclassifiedOccupied: number
}

/**
 * Tập id khu vực thuộc về một kho: chính nó + toàn bộ cây con. Trả `null` khi không chọn kho
 * (nghĩa là dùng toàn bộ vị trí của phân hệ).
 */
export function warehouseScopeZoneIds(zones: CatStatZone[], warehouseId?: string | null): Set<string> | null {
    if (!warehouseId) return null
    const childrenOf = new Map<string, string[]>()
    for (const zone of zones) {
        const parentId = zone.parent_id
        if (!parentId) continue
        const siblings = childrenOf.get(parentId) || []
        siblings.push(zone.id)
        childrenOf.set(parentId, siblings)
    }

    const validIds = new Set<string>([warehouseId])
    const stack = [warehouseId]
    while (stack.length > 0) {
        const current = stack.pop()!
        for (const childId of childrenOf.get(current) || []) {
            if (validIds.has(childId)) continue
            validIds.add(childId)
            stack.push(childId)
        }
    }
    return validIds
}

/** lot id -> tập danh mục của mọi dòng trong LOT (một LOT có thể mang nhiều danh mục). */
export function buildLotCategoryMap(lots: CatStatLot[]): Map<string, string[]> {
    const map = new Map<string, string[]>()
    for (const lot of lots) {
        const ids = new Set<string>()
        for (const item of lot.lot_items || []) {
            resolveCategories(item.products, item.category_id).ids.forEach(id => ids.add(id))
        }
        map.set(lot.id, Array.from(ids))
    }
    return map
}

export function buildCategoryPositionStats({
    categories,
    positions,
    lotCategories,
    zones,
    warehouseId
}: {
    categories: Array<{ id: string; name: string }>
    positions: CatStatPosition[]
    lotCategories: Map<string, string[]>
    zones: CatStatZone[]
    warehouseId?: string | null
}): CategoryPositionResult {
    const validIds = warehouseScopeZoneIds(zones, warehouseId)
    const targetPositions = validIds
        ? positions.filter(p => p.zone_id && validIds.has(p.zone_id))
        : positions

    const occupied = targetPositions.filter(p => !!p.lot_id)
    const totalPositions = targetPositions.length
    const occupiedPositions = occupied.length

    let unclassifiedOccupied = 0
    for (const position of occupied) {
        if ((lotCategories.get(position.lot_id!) || []).length === 0) unclassifiedOccupied++
    }

    const stats = categories.map(cat => {
        let count = 0
        for (const position of occupied) {
            if ((lotCategories.get(position.lot_id!) || []).includes(cat.id)) count++
        }
        return {
            categoryId: cat.id,
            name: cat.name,
            count,
            pctOfOccupied: occupiedPositions > 0 ? (count / occupiedPositions) * 100 : 0,
            pctOfTotal: totalPositions > 0 ? (count / totalPositions) * 100 : 0
        }
    })

    return { stats, totalPositions, occupiedPositions, unclassifiedOccupied }
}
