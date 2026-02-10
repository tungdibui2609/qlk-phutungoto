import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Common aggregation logic used by both Audit and Reconciliation.
 */
export function aggregateLotData(lots: any[]) {
    const totals = new Map<string, number>()

    lots.forEach((lot: any) => {
        const processItem = (pid: string, qty: number, unit: string) => {
            const key = `${pid}_${unit || 'Cái'}`
            totals.set(key, (totals.get(key) || 0) + (qty || 0))
        }

        if (lot.lot_items && lot.lot_items.length > 0) {
            lot.lot_items.forEach((item: any) => {
                if (!item.product_id) return
                processItem(
                    item.product_id,
                    item.quantity,
                    item.unit || item.products?.unit
                )
            })
        } else if (lot.product_id) {
            processItem(
                lot.product_id,
                lot.quantity,
                lot.products?.unit
            )
        }
    })

    return totals
}

/**
 * Aggregates physical inventory from lots and lot_items.
 * Returns a Map where key is `${product_id}_${unit}` and value is total quantity.
 */
export async function getPhysicalInventorySnapshot(
    supabase: SupabaseClient,
    systemCode: string,
    warehouseName?: string
) {
    const lots = await getLotInventoryForReconciliation(supabase, systemCode, warehouseName)
    return aggregateLotData(lots || [])
}

/**
 * Fetches lot-based inventory specifically for reconciliation.
 */
export async function getLotInventoryForReconciliation(
    supabase: SupabaseClient,
    systemType: string,
    warehouseName?: string
) {
    let query = supabase
        .from('lots')
        .select(`
            id,
            product_id,
            quantity,
            warehouse_name,
            lot_items (
                product_id,
                quantity,
                unit,
                products (name, sku, unit, system_type)
            ),
            products (name, sku, unit, system_type)
        `)
        .eq('status', 'active')
        .eq('system_code', systemType)

    if (warehouseName && warehouseName !== 'Tất cả') {
        query = query.eq('warehouse_name', warehouseName)
    }

    const { data, error } = await query
    if (error) {
        console.error('Error fetching lot inventory:', error)
        throw error
    }

    return data
}
