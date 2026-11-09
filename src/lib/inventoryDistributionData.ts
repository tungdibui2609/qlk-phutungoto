import { supabase } from '@/lib/supabaseClient'
import { fetchAllPaged } from '@/lib/supabasePaged'
import { buildLotCategoryMap, type CatStatLot } from '@/lib/categoryPositionStats'
import { buildZoneLookup } from '@/lib/warehouseFillRate'

/**
 * Nguồn số liệu của dashboard "Tỉ lệ phân bố hàng hóa tồn kho" tách ra lib để
 * báo cáo Tồn kho theo LOT nhúng đúng hai biểu đồ đó vào Excel mà không phải
 * chép lại câu query (chép tay thì số lệch nhau chỉ là vấn đề thời gian).
 */

export type DistributionProductRef = {
    sku: string
    name: string
    unit: string
    internal_code: string | null
    internal_name: string | null
    product_category_rel?: { category_id: string }[]
}

export type DistributionLot = {
    id: string
    product_id: string | null
    quantity: number | null
    unit?: string | null
    lot_items: Array<{
        product_id: string | null
        quantity: number | null
        unit: string | null
        products: DistributionProductRef | null
    }> | null
    products: DistributionProductRef | null
}

export type CategoryPositionRaw = {
    positions: Array<{ id: string; lot_id: string | null; zone_id: string | null }>
    zones: Array<{ id: string; code: string | null; name: string | null; parent_id: string | null; level: number | null }>
    lotCategories: Map<string, string[]>
}

/** Hai hàm quy đổi của hook useUnitConversion — truyền vào để lib không phải là React hook. */
export interface KgConversion {
    toBaseAmount: (productId: string, unit: string, qty: number, baseUnit: string) => number
    getBaseToKgRate: (productId: string, baseUnit: string) => number | null
}

export interface KgChartItem {
    name: string
    code: string | null
    value: number
    percentage: number
    originalSku: string
}

export async function fetchDistributionLots(systemCode: string): Promise<DistributionLot[]> {
    return fetchAllPaged<DistributionLot>((from, to) =>
        (supabase.from('lots') as any)
            .select(`
                id,
                product_id,
                quantity,
                lot_items (
                    product_id,
                    quantity,
                    unit,
                    products (
                        sku,
                        name,
                        unit,
                        internal_code,
                        internal_name,
                        product_category_rel (category_id)
                    )
                ),
                products (
                    sku,
                    name,
                    unit,
                    internal_code,
                    internal_name,
                    product_category_rel (category_id)
                )
            `)
            .eq('status', 'active')
            .eq('system_code', systemCode)
            .order('id')
            .range(from, to)
    )
}

export async function fetchDistributionCategories(systemCode: string): Promise<Array<{ id: string; name: string }>> {
    const { data } = await supabase
        .from('categories')
        .select('id, name')
        .eq('system_type', systemCode)
    return data || []
}

export async function fetchCategoryPositionRaw(systemCode: string): Promise<CategoryPositionRaw> {
    const [posRows, zoneList, linkRows] = await Promise.all([
        fetchAllPaged<{ id: string; lot_id: string | null }>((from, to) =>
            (supabase.from('positions') as any)
                .select('id, lot_id')
                .eq('system_type', systemCode)
                .order('id')
                .range(from, to)
        ),
        fetchAllPaged<{ id: string; code: string | null; name: string | null; parent_id: string | null; level: number | null }>((from, to) =>
            (supabase.from('zones') as any)
                .select('id, code, name, parent_id, level')
                .eq('system_type', systemCode)
                .order('level')
                .order('code')
                .range(from, to)
        ),
        fetchAllPaged<{ zone_id: string; position_id: string }>((from, to) =>
            (supabase.from('zone_positions') as any)
                .select('zone_id, position_id, positions!inner(*)')
                .eq('positions.system_type', systemCode)
                .order('zone_id')
                .order('position_id')
                .range(from, to)
        )
    ])

    const zoneLookup = buildZoneLookup(linkRows)
    const positionsWithZone = posRows.map(p => ({ ...p, zone_id: zoneLookup.get(p.id) || null }))

    // Chỉ lấy đúng các LOT đang chiếm ô (không lọc status) — giống trang trạng thái kho.
    const occupiedLotIds = Array.from(new Set(posRows.map(p => p.lot_id).filter((id): id is string => !!id)))
    const lotsForCategories: CatStatLot[] = []
    const chunkSize = 150
    for (let i = 0; i < occupiedLotIds.length; i += chunkSize) {
        const chunk = occupiedLotIds.slice(i, i + chunkSize)
        const { data, error } = await (supabase.from('lots') as any)
            .select('id, lot_items(category_id, products(sku, name, category_id, product_category_rel(category_id)))')
            .in('id', chunk)
        if (error) throw error
        if (data) lotsForCategories.push(...(data as CatStatLot[]))
    }

    return {
        positions: positionsWithZone,
        zones: zoneList,
        lotCategories: buildLotCategoryMap(lotsForCategories)
    }
}

/**
 * Gom khối lượng tồn theo sản phẩm (quy đổi KG) — đúng luật của card dashboard:
 * gộp theo mã nội bộ, ưu tiên dòng lot_items, lot cũ không có lot_items thì đọc thẳng lot.
 */
export function aggregateKgByProduct(
    lots: DistributionLot[],
    conversion: KgConversion,
    selectedCategoryIds: string[] = []
): { items: KgChartItem[]; totalWeight: number } {
    const { toBaseAmount, getBaseToKgRate } = conversion
    const aggregation = new Map<string, { value: number; productName: string; internalName: string | null; internalCode: string | null; sku: string }>()

    const process = (
        pid: string,
        sku: string,
        productName: string,
        qty: number,
        unit: string,
        baseUnit: string,
        internalName: string | null,
        internalCode: string | null,
        categoryIds: string[]
    ) => {
        if (selectedCategoryIds.length > 0) {
            const hasMatch = categoryIds.some(id => selectedCategoryIds.includes(id)) ||
                (categoryIds.length === 0 && selectedCategoryIds.includes('none'))
            if (!hasMatch) return
        }

        const kgRate = getBaseToKgRate(pid, baseUnit)
        if (kgRate !== null) {
            const baseQty = toBaseAmount(pid, unit, qty, baseUnit)
            const kgQty = baseQty * kgRate

            const key = internalCode || sku
            const current = aggregation.get(key) || { value: 0, productName, internalName, internalCode, sku }
            aggregation.set(key, {
                ...current,
                productName: current.productName || productName,
                value: current.value + kgQty
            })
        }
    }

    lots.forEach(lot => {
        if (lot.lot_items && lot.lot_items.length > 0) {
            lot.lot_items.forEach(item => {
                if (item.products && item.products.sku && item.product_id) {
                    process(
                        item.product_id,
                        item.products.sku,
                        item.products.name,
                        item.quantity || 0,
                        item.unit || item.products.unit,
                        item.products.unit,
                        item.products.internal_name,
                        item.products.internal_code,
                        item.products.product_category_rel?.map(r => r.category_id) || []
                    )
                }
            })
        } else if (lot.products && lot.products.sku && lot.product_id) {
            const u = lot.quantity ? lot.unit || lot.products.unit : lot.products.unit
            process(
                lot.product_id,
                lot.products.sku,
                lot.products.name,
                lot.quantity || 0,
                u,
                lot.products.unit,
                lot.products.internal_name,
                lot.products.internal_code,
                lot.products.product_category_rel?.map(r => r.category_id) || []
            )
        }
    })

    const totalWeight = Array.from(aggregation.values()).reduce((a, b) => a + b.value, 0)
    const items = Array.from(aggregation.values()).map(item => ({
        name: item.productName || item.internalName || item.sku,
        code: item.internalCode || item.sku,
        value: item.value,
        percentage: totalWeight > 0 ? (item.value / totalWeight) * 100 : 0,
        originalSku: item.sku
    }))
    items.sort((a, b) => b.value - a.value)
    return { items, totalWeight }
}
