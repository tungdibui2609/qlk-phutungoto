import { SupabaseClient } from '@supabase/supabase-js'

export interface LotServiceParams {
    supabase: SupabaseClient
    lotId: string
    lotCode: string
    systemCode: string
    unitNameMap: Map<string, string>
    conversionMap: Map<string, Map<string, number>>
}

export interface SplitPreviewResult {
    remainingQtyInteger: number
    remainingUnitInteger: string
    remainingQtyFractional: number
    remainingUnitFractional: string
    displayLabel: string
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
     * Calculates what the remaining breakdown will be after a split
     */
    calculateSplitResult(params: {
        item: any
        consumedOriginalQty: number
        unitNameMap: Map<string, string>
        conversionMap: Map<string, Map<string, number>>
        preferredUnit?: string
    }): SplitPreviewResult | null {
        const { item, consumedOriginalQty, unitNameMap, conversionMap, preferredUnit } = params
        const remainingQty = (item.quantity || 0) - consumedOriginalQty
        const baseUnit = item.products?.unit || ''
        const originalUnit = item.unit || baseUnit

        if (remainingQty <= 0.000001) return null

        const floorRemaining = Math.floor(remainingQty + 0.000001)
        const fractionalRemaining = remainingQty - floorRemaining

        if (fractionalRemaining > 0.000001) {
            let targetUnit = baseUnit
            let targetQty = 0

            const getRate = (uName: string) => {
                const uid = unitNameMap.get(uName.toLowerCase())
                const rates = conversionMap.get(item.product_id || '')
                return uid ? (rates?.get(uid) || 1) : 1
            }

            const currentRate = getRate(originalUnit)
            const fractionalBase = fractionalRemaining * currentRate

            if (preferredUnit && preferredUnit.toLowerCase() !== baseUnit.toLowerCase()) {
                const preferredRate = getRate(preferredUnit)
                if (preferredRate > 0) {
                    targetUnit = preferredUnit
                    targetQty = fractionalBase / preferredRate
                } else {
                    targetQty = fractionalBase
                }
            } else {
                targetQty = fractionalBase
            }

            let displayLabel = ""
            if (floorRemaining > 0) {
                displayLabel = `${floorRemaining} ${originalUnit} và ${Number(targetQty.toFixed(6))} ${targetUnit}`
            } else {
                displayLabel = `${Number(targetQty.toFixed(6))} ${targetUnit}`
            }

            return {
                remainingQtyInteger: floorRemaining,
                remainingUnitInteger: originalUnit,
                remainingQtyFractional: Number(targetQty.toFixed(6)),
                remainingUnitFractional: targetUnit,
                displayLabel
            }
        } else {
            return {
                remainingQtyInteger: Number(floorRemaining.toFixed(6)),
                remainingUnitInteger: originalUnit,
                remainingQtyFractional: 0,
                remainingUnitFractional: originalUnit,
                displayLabel: `${Number(floorRemaining.toFixed(6))} ${originalUnit}`
            }
        }
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
        const result = this.calculateSplitResult({
            item,
            consumedOriginalQty,
            unitNameMap,
            conversionMap,
            preferredUnit
        })

        if (!result) {
            const { error: delError } = await supabase.from('lot_items').delete().eq('id', item.id)
            if (delError) throw delError
            return
        }

        if (result.remainingQtyFractional > 0) {
            // 1. Update/Delete current row for Integer part
            if (result.remainingQtyInteger > 0) {
                const { error: updError } = await supabase.from('lot_items').update({
                    quantity: result.remainingQtyInteger,
                    unit: result.remainingUnitInteger
                }).eq('id', item.id)
                if (updError) throw updError
            } else {
                const { error: delError } = await supabase.from('lot_items').delete().eq('id', item.id)
                if (delError) throw delError
            }

            // 2. Create new row for Fractional part
            const { error: insError } = await supabase.from('lot_items').insert({
                lot_id: lotId,
                product_id: item.product_id,
                quantity: result.remainingQtyFractional,
                unit: result.remainingUnitFractional
            })
            if (insError) throw insError
        } else {
            // Simple update for integer remaining
            const { error: updError } = await supabase.from('lot_items').update({
                quantity: result.remainingQtyInteger,
                unit: result.remainingUnitInteger
            }).eq('id', item.id)
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
