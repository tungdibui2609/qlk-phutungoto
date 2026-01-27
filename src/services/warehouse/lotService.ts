import { SupabaseClient } from '@supabase/supabase-js'

export interface LotServiceParams {
    supabase: SupabaseClient
    lotId: string
    lotCode: string
    systemCode: string
    unitNameMap: Map<string, string>
    conversionMap: Map<string, Map<string, number>>
}

/**
 * Standardized logic for Lot operations
 */
export const lotService = {
    /**
     * Internal helper to convert quantity to Base Unit
     */
    toBaseAmount(
        productId: string,
        unitName: string,
        qty: number,
        baseUnitName: string,
        unitNameMap: Map<string, string>,
        conversionMap: Map<string, Map<string, number>>
    ): number {
        if (!productId || !unitName || !baseUnitName) return qty
        if (unitName.toLowerCase() === baseUnitName.toLowerCase()) return qty

        const uid = unitNameMap.get(unitName.toLowerCase())
        if (!uid) return qty

        const rates = conversionMap.get(productId)
        if (rates && rates.has(uid)) {
            const result = qty * rates.get(uid)!
            return Number(result.toFixed(6)) // Prevent floating point issues
        }
        return qty
    },

    /**
     * Calculates the total base quantity of a lot by summing all its items
     */
    async calculateTotalBaseQty(params: {
        supabase: SupabaseClient
        lotId: string
        unitNameMap: Map<string, string>
        conversionMap: Map<string, Map<string, number>>
    }): Promise<number> {
        const { supabase, lotId, unitNameMap, conversionMap } = params
        const { data: items, error } = await supabase
            .from('lot_items')
            .select('quantity, unit, products(unit, id)')
            .eq('lot_id', lotId)

        if (error) throw error

        let total = 0
        items?.forEach((item: any) => {
            const baseUnit = item.products?.unit || ''
            total += this.toBaseAmount(item.products?.id, item.unit || baseUnit, item.quantity || 0, baseUnit, unitNameMap, conversionMap)
        })

        return Number(total.toFixed(6))
    },

    /**
     * Updates Lot items with Auto-Split logic:
     * If remaining quantity is fractional, converts it to Base Unit (e.g., Kg)
     * and creates a new line item.
     */
    async processItemAutoSplit(params: {
        supabase: SupabaseClient
        lotId: string
        item: any // current lot_item
        consumedOriginalQty: number
        unitNameMap: Map<string, string>
        conversionMap: Map<string, Map<string, number>>
        preferredUnit?: string
    }) {
        const { supabase, lotId, item, consumedOriginalQty, unitNameMap, conversionMap, preferredUnit } = params
        const remainingQty = (item.quantity || 0) - consumedOriginalQty
        const baseUnit = item.products?.unit || ''

        if (remainingQty <= 0.000001) {
            const { error: delError } = await supabase.from('lot_items').delete().eq('id', item.id)
            if (delError) throw delError
            return
        }

        const floorRemaining = Math.floor(remainingQty + 0.000001)
        const fractionalRemaining = remainingQty - floorRemaining

        if (fractionalRemaining > 0.000001) {
            // 1. Update/Delete current row for Integer part
            if (floorRemaining > 0) {
                const { error: updError } = await supabase.from('lot_items').update({ quantity: floorRemaining }).eq('id', item.id)
                if (updError) throw updError
            } else {
                const { error: delError } = await supabase.from('lot_items').delete().eq('id', item.id)
                if (delError) throw delError
            }

            // 2. Create new row for Fractional part
            // Logic: Try to use Preferred Unit if possible, otherwise Base Unit
            let targetUnit = baseUnit
            let targetQty = 0

            // Helper to get rate: 1 FromUnit = rate * BaseUnit
            const getRate = (uName: string) => {
                const uid = unitNameMap.get(uName.toLowerCase())
                const rates = conversionMap.get(item.product_id || '')
                return uid ? (rates?.get(uid) || 1) : 1
            }

            if (preferredUnit && preferredUnit.toLowerCase() !== baseUnit.toLowerCase()) {
                // Check if we can convert back to preferred unit cleanly?
                // Actually, user wants the "leftover" to be in 'preferredUnit' if compatible.
                // We have 'fractionalRemaining' in OriginalUnit (currently item.unit).

                // Convert Fractional(OriginalUnit) -> Base -> Preferred

                // 1. To Base
                const currentRate = getRate(item.unit || baseUnit)
                const fractionalBase = fractionalRemaining * currentRate

                // 2. To Preferred
                // 1 Preferred = preferredRate * Base
                // So 1 Base = 1/preferredRate Preferred
                const preferredRate = getRate(preferredUnit)

                if (preferredRate > 0) {
                    targetUnit = preferredUnit
                    targetQty = fractionalBase / preferredRate
                } else {
                    // Fallback to base
                    targetQty = fractionalBase
                }
            } else {
                // Use Base Unit
                const currentRate = getRate(item.unit || baseUnit)
                targetQty = fractionalRemaining * currentRate
            }

            const { error: insError } = await supabase.from('lot_items').insert({
                lot_id: lotId,
                product_id: item.product_id,
                quantity: Number(targetQty.toFixed(6)),
                unit: targetUnit
            })
            if (insError) throw insError
        } else {
            // Simple update for integer remaining
            const { error: updError } = await supabase.from('lot_items').update({ quantity: Number(floorRemaining.toFixed(6)) }).eq('id', item.id)
            if (updError) throw updError
        }
    },

    /**
     * Standardizes the Metadata update for Exports
     */
    async addExportToHistory(params: {
        supabase: SupabaseClient
        lotId: string
        originalMetadata: any
        exportData: {
            id: string
            customer: string
            description: string
            location_code: string | null
            items: Record<string, any>
        }
    }) {
        const { supabase, lotId, originalMetadata, exportData } = params
        const metadata = originalMetadata ? { ...originalMetadata } : {}
        if (!metadata.system_history) metadata.system_history = {}
        if (!metadata.system_history.exports) metadata.system_history.exports = []

        metadata.system_history.exports.push({
            ...exportData,
            date: new Date().toISOString(),
            draft: true,
            order_id: null
        })

        return metadata
    }
}
