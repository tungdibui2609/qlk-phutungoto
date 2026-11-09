import { supabase } from '@/lib/supabaseClient'
import { fetchAllPaged } from '@/lib/supabasePaged'

/**
 * Nguồn số liệu của card dashboard "Số lượng Container tồn kho theo từng mặt hàng"
 * tách ra lib để báo cáo Tồn kho theo LOT nhúng đúng biểu đồ đó vào Excel mà không
 * chép lại câu query / công thức quy đổi thùng (chép tay thì số lệch nhau chỉ là vấn đề thời gian).
 */

export const DEFAULT_CONTAINER_TOP_N = 10

export type ContainerProductRef = {
    id?: string
    sku: string
    name: string
    unit: string
    boxes_per_container?: number | null
    internal_code: string | null
    internal_name: string | null
    product_category_rel?: { category_id: string }[]
}

export type ContainerLot = {
    id: string
    product_id: string | null
    quantity: number | null
    unit?: string | null
    lot_items: Array<{
        product_id: string | null
        quantity: number | null
        unit: string | null
        products: ContainerProductRef | null
    }> | null
    products: ContainerProductRef | null
}

export interface ProductContainerStat {
    id: string
    sku: string
    name: string
    totalBoxes: number
    boxesPerContainer: number
    containers: number
    categoryIds: string[]
    hasConfig: boolean
}

/** Cấu hình hiển thị biểu đồ Cont lưu ở bảng dashboard_chart_settings — mọi máy đồng bộ. */
export interface ContainerChartSettings {
    pinnedIds: string[]
    categoryIds: string[]
    topN: number
}

/** Hai hàm quy đổi của hook useUnitConversion — truyền vào để lib không phải là React hook. */
export interface ContainerConversion {
    convertUnit: (productId: string, fromUnit: string, toUnit: string, qty: number, baseUnit: string) => number
    getBaseAmount: (productId: string, unit: string, qty: number, baseUnit: string) => number
}

export async function fetchContainerLots(systemCode: string): Promise<ContainerLot[]> {
    return fetchAllPaged<ContainerLot>((from, to) =>
        (supabase.from('lots') as any)
            .select(`
                id,
                product_id,
                quantity,
                lot_items (
                    id,
                    quantity,
                    unit,
                    product_id,
                    products (
                        id,
                        sku,
                        name,
                        unit,
                        boxes_per_container,
                        internal_code,
                        internal_name,
                        product_category_rel (category_id)
                    )
                ),
                products (
                    id,
                    sku,
                    name,
                    unit,
                    boxes_per_container,
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

/** Đọc đúng khóa cấu hình mà card dùng; không đọc được (trang in mở ẩn danh) thì về mặc định. */
export async function readContainerChartSettings(systemCode: string): Promise<ContainerChartSettings> {
    const fallback: ContainerChartSettings = { pinnedIds: [], categoryIds: [], topN: DEFAULT_CONTAINER_TOP_N }
    try {
        const { data, error } = await (supabase.from('dashboard_chart_settings' as any) as any)
            .select('pinned_ids, category_ids, top_n')
            .eq('id', `container_chart_${systemCode}`)
            .maybeSingle()
        if (error || !data) return fallback
        return {
            pinnedIds: Array.isArray(data.pinned_ids) ? (data.pinned_ids as string[]) : [],
            categoryIds: Array.isArray(data.category_ids) ? (data.category_ids as string[]) : [],
            topN: Number(data.top_n) > 0 ? Number(data.top_n) : DEFAULT_CONTAINER_TOP_N
        }
    } catch {
        return fallback
    }
}

/**
 * Gom tồn kho theo sản phẩm và quy ra số container — đúng luật của card:
 * đơn vị thùng/sọt/hộp/bao/két đếm thẳng, đơn vị khác quy về Thùng rồi mới chia định mức;
 * sản phẩm chưa cài định mức vẫn có dòng (containers = 0) để báo cáo thấy chỗ còn thiếu.
 */
export function aggregateContainerStock(
    lots: ContainerLot[],
    conversion: ContainerConversion,
    selectedCategoryIds: string[] = []
): ProductContainerStat[] {
    const { convertUnit, getBaseAmount } = conversion
    const aggregation = new Map<string, ProductContainerStat>()

    const processItem = (
        pid: string,
        prod: ContainerProductRef,
        quantity: number,
        unit: string | null
    ) => {
        let categoryIds: string[] = []
        if (Array.isArray(prod.product_category_rel)) {
            categoryIds = prod.product_category_rel.map(r => r?.category_id).filter(Boolean)
        } else if (prod.product_category_rel && typeof prod.product_category_rel === 'object' && (prod.product_category_rel as any).category_id) {
            categoryIds = [(prod.product_category_rel as any).category_id]
        }

        if (selectedCategoryIds.length > 0) {
            const hasMatch = categoryIds.some(id => selectedCategoryIds.includes(id)) ||
                (categoryIds.length === 0 && selectedCategoryIds.includes('none'))
            if (!hasMatch) return
        }

        let boxCount = 0
        const unitStr = unit || prod.unit || ''
        const isDirectBox = /thùng|thung|sọt|sot|hộp|hop|bao|két/i.test(unitStr)

        if (isDirectBox) {
            boxCount = quantity || 0
        } else {
            const converted = convertUnit(pid, unitStr, 'Thùng', quantity, prod.unit)
            if (converted > 0 && converted !== quantity) {
                boxCount = converted
            } else {
                const baseKg = getBaseAmount(pid, unitStr, quantity, prod.unit)
                boxCount = baseKg > 0 ? baseKg / 20 : quantity
            }
        }

        const key = pid || prod.sku
        const existing = aggregation.get(key)
        const boxesPerContainer = prod.boxes_per_container || 0

        if (existing) {
            existing.totalBoxes += boxCount
            existing.containers = boxesPerContainer > 0 ? existing.totalBoxes / boxesPerContainer : 0
        } else {
            aggregation.set(key, {
                id: prod.id || pid,
                sku: prod.sku,
                name: prod.name || prod.internal_name || prod.sku,
                totalBoxes: boxCount,
                boxesPerContainer,
                containers: boxesPerContainer > 0 ? boxCount / boxesPerContainer : 0,
                categoryIds,
                hasConfig: boxesPerContainer > 0
            })
        }
    }

    lots.forEach(lot => {
        if (lot.lot_items && lot.lot_items.length > 0) {
            lot.lot_items.forEach(item => {
                if (item.products && item.products.sku) {
                    processItem(item.product_id || '', item.products, item.quantity || 0, item.unit)
                }
            })
        } else if (lot.products && lot.products.sku) {
            const u = lot.quantity ? lot.unit || lot.products.unit : lot.products.unit
            processItem(lot.product_id || '', lot.products, lot.quantity || 0, u)
        }
    })

    return Array.from(aggregation.values())
}

export type ContainerSortBy = 'containers' | 'boxes' | 'name'

export function sortContainerStats(list: ProductContainerStat[], sortBy: ContainerSortBy): ProductContainerStat[] {
    const sorted = [...list]
    if (sortBy === 'containers') {
        sorted.sort((a, b) => b.containers - a.containers || b.totalBoxes - a.totalBoxes)
    } else if (sortBy === 'boxes') {
        sorted.sort((a, b) => b.totalBoxes - a.totalBoxes)
    } else {
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    }
    return sorted
}

/**
 * Tập sản phẩm lên biểu đồ khi bấm tab "Tất cả": lọc theo danh mục đã cấu hình,
 * rồi danh sách chọn tay (pinned) hoặc Top N — đúng thứ tự ưu tiên của card.
 */
export function filterByChartCategories(
    stats: ProductContainerStat[],
    categoryIds: string[]
): ProductContainerStat[] {
    if (categoryIds.length === 0) return stats
    return stats.filter(p => {
        const cIds = Array.isArray(p.categoryIds) ? p.categoryIds : []
        return cIds.some(id => categoryIds.includes(id)) ||
            (cIds.length === 0 && categoryIds.includes('none'))
    })
}

export function selectConfiguredProducts(
    stats: ProductContainerStat[],
    settings: ContainerChartSettings
): ProductContainerStat[] {
    const source = filterByChartCategories(stats, settings.categoryIds)

    return settings.pinnedIds.length > 0
        ? source.filter(p => settings.pinnedIds.includes(p.id))
        : source.slice(0, settings.topN)
}
