import { SupabaseClient } from '@supabase/supabase-js'

export interface UnbundleParams {
    supabase: SupabaseClient
    productId: string
    productName: string
    baseUnit: string
    reqUnit: string
    reqQty: number
    currentLiquid: number
    costPrice: number
    rate: number
    warehouseName: string
    systemCode: string
    mainOrderCode: string
    convTypeId?: string
    generateOrderCode: (type: 'PNK' | 'PXK') => Promise<string>
}

export const unbundleService = {
    /**
     * Executes the Auto-Unbundle process:
     * 1. Creates a Conversion Outbound Order (PXK) to remove base units.
     * 2. Creates a Conversion Inbound Order (PNK) to add converted smaller units.
     */
    /**
     * Extracts number from parentheses, e.g. "Thùng (15kg)" -> 15
     */
    parseRateFromName(name: string): number | null {
        if (!name) return null
        const match = name.match(/\(([\d.]+)\s*\w*\)/)
        if (match && match[1]) {
            const val = parseFloat(match[1])
            return isNaN(val) ? null : val
        }
        return null
    },

    /**
     * Checks if a product needs unbundling to fulfill a requested quantity.
     * Returns metadata about the unbundle operation if needed.
     */
    checkUnbundle(params: {
        productId: string
        unit: string
        qty: number
        products: any[]
        units: any[]
        unitNameMap: Map<string, string>
        conversionMap: Map<string, Map<string, number>>
        unitStockMap: Map<string, number>
    }): { needsUnbundle: boolean, unbundleInfo?: string, sourceUnit?: string, rate?: number } {
        const { productId, unit, qty, products, units, unitNameMap, conversionMap, unitStockMap } = params
        const product = products.find(p => p.id === productId)
        if (!product || !unit) return { needsUnbundle: false }

        const normalize = (s: string) => s.normalize('NFC').toLowerCase().trim()
        const strip = (s: string) => s.replace(/\s*\([^)]*\)/g, '').trim()

        const normReqUnit = normalize(unit)
        const strippedReqUnit = strip(normReqUnit)

        /**
         * Robust stock lookup.
         * Tries exact match, then tries match by stripped name if ambiguous.
         */
        const getStockByUnit = (targetUnit: string) => {
            const nTarget = normalize(targetUnit)
            const sTarget = strip(nTarget)

            // 1. Exact match
            let val = unitStockMap.get(`${productId}_${nTarget}`)
            if (val !== undefined) return val

            // 2. Fuzzy match (if multiple exist with same name but different capacity, we can't be sure, but we try)
            for (const [key, qty] of unitStockMap.entries()) {
                if (!key.startsWith(`${productId}_`)) continue
                const unitPart = key.split(`${productId}_`)[1]
                if (strip(unitPart) === sTarget) return qty
            }
            return 0
        }

        // 1. Check direct liquid stock
        const currentLiquid = getStockByUnit(unit)
        if (currentLiquid >= qty - 0.000001) return { needsUnbundle: false }

        const deficit = qty - currentLiquid
        const baseUnitName = product.unit || ''
        const normBaseName = normalize(baseUnitName)
        const strippedBaseName = strip(normBaseName)

        // Case 1: Break Base Unit (Official Unit)
        if (normReqUnit !== normBaseName && strippedReqUnit !== strippedBaseName) {
            const currentBase = getStockByUnit(baseUnitName)
            if (currentBase > 0) {
                // NEW LOGIC: Rate = Rate(Base) / Rate(Req)
                const rateBaseVal = this.parseRateFromName(product.unit || '') || 1
                const rateReqVal = this.parseRateFromName(unit) || 1
                
                let rateBaseToReq = rateBaseVal / rateReqVal

                // Fallback to conversionMap if name-based parsing fails to give a meaningful rate
                if (!this.parseRateFromName(unit) && !this.parseRateFromName(product.unit || '')) {
                    let rUnitId = unitNameMap.get(normReqUnit)
                    if (!rUnitId) {
                        for (const [name, id] of unitNameMap.entries()) {
                            if (name === normReqUnit) { // Exact match priority
                                rUnitId = id
                                break
                            }
                        }
                    }
                    if (!rUnitId) {
                        for (const [name, id] of unitNameMap.entries()) {
                            if (name.startsWith(normReqUnit) || normReqUnit.startsWith(name)) {
                                rUnitId = id
                                break
                            }
                        }
                    }
                    const rateReqStackToBase = conversionMap.get(productId)?.get(rUnitId || '') || 0
                    if (rateReqStackToBase > 0) {
                        rateBaseToReq = 1 / rateReqStackToBase
                    }
                }

                if (rateBaseToReq && rateBaseToReq > 1.000001) { // Only break if base is larger than req
                    const baseToBreak = Math.ceil(deficit / rateBaseToReq - 0.000001)

                    if (currentBase >= baseToBreak) {
                        return {
                            needsUnbundle: true,
                            unbundleInfo: `Tự động: Bẻ ${baseToBreak} ${product.unit} -> ${(baseToBreak * rateBaseToReq).toFixed(2).replace(/\.00$/, '')} ${unit}`,
                            sourceUnit: product.unit ?? undefined,
                            rate: rateBaseToReq
                        }
                    }
                }
            }
        }

        // Case 2: Break OTHER units
        for (const pu of product.product_units || []) {
            const altUnitName = units.find(u => u.id === pu.unit_id)?.name
            if (!altUnitName) continue
            const normAltUnit = normalize(altUnitName)
            const strippedAltUnit = strip(normAltUnit)

            if (normAltUnit === normReqUnit || strippedAltUnit === strippedReqUnit) continue

            const currentAlt = getStockByUnit(altUnitName)
            if (currentAlt > 0) {
                // PRIORITY 1: Parse rate from req unit name
                let rateAltToReq = 0
                const pRateReq = this.parseRateFromName(unit)
                const pRateAlt = this.parseRateFromName(altUnitName)

                if (pRateReq !== null && pRateAlt !== null) {
                    rateAltToReq = pRateAlt / pRateReq
                } else {
                    // PRIORITY 2: Map to IDs
                    const altToBase = pu.conversion_rate
                    let reqUnitId = unitNameMap.get(normReqUnit)

                    if (!reqUnitId) {
                        for (const [name, id] of unitNameMap.entries()) {
                            if (name.startsWith(normReqUnit) || normReqUnit.startsWith(name)) {
                                reqUnitId = id
                                break
                            }
                        }
                    }

                    const reqToBase = normReqUnit === baseUnitName ? 1 : (conversionMap.get(productId)?.get(reqUnitId || '') || 1)
                    rateAltToReq = altToBase / reqToBase
                }

                if (rateAltToReq > 0) {
                    const altToBreak = Math.ceil(deficit / rateAltToReq - 0.000001)

                    if (currentAlt >= altToBreak) {
                        return {
                            needsUnbundle: true,
                            unbundleInfo: `Tự động: Bẻ ${altToBreak} ${altUnitName} -> ${(altToBreak * rateAltToReq).toFixed(2).replace(/\.00$/, '')} ${unit}`,
                            sourceUnit: altUnitName,
                            rate: rateAltToReq
                        }
                    }
                }
            }
        }

        return { needsUnbundle: false }
    },

    /**
     * Executes the Auto-Unbundle process:
     * 1. Creates a Conversion Outbound Order (PXK) to remove base units.
     * 2. Creates a Conversion Inbound Order (PNK) to add converted smaller units.
     */
    async executeAutoUnbundle(params: UnbundleParams) {
        const {
            supabase, productId, productName, baseUnit, reqUnit, reqQty,
            currentLiquid, costPrice, rate, warehouseName, systemCode,
            mainOrderCode, convTypeId, generateOrderCode
        } = params

        const deficit = reqQty - currentLiquid
        const baseToBreak = Math.ceil(deficit / rate - 0.000001)

        if (baseToBreak <= 0) return null

        // A. Create PXK (Chuyển đổi) - Out Base Units
        const pxkCode = await generateOrderCode('PXK')
        const { data: pxk, error: pxkErr } = await (supabase.from('outbound_orders') as any).insert({
            code: pxkCode + '-AUTO',
            status: 'Completed',
            type: 'Conversion',
            order_type_id: convTypeId,
            warehouse_name: warehouseName,
            description: `Tự động bẻ gói cho phiếu ${mainOrderCode}`,
            system_code: systemCode,
            system_type: systemCode
        }).select().single()

        if (pxkErr) throw pxkErr

        await (supabase.from('outbound_order_items') as any).insert({
            order_id: pxk.id,
            product_id: productId,
            product_name: productName,
            unit: baseUnit,
            quantity: Number(baseToBreak.toFixed(6)),
            price: costPrice || 0
        })

        // B. Create PNK (Chuyển đổi) - In Requested Units
        const pnkCode = await generateOrderCode('PNK')
        const { data: pnk, error: pnkErr } = await (supabase.from('inbound_orders') as any).insert({
            code: pnkCode + '-AUTO',
            status: 'Completed',
            type: 'Conversion',
            order_type_id: convTypeId,
            warehouse_name: warehouseName,
            description: `Tự động bẻ gói cho phiếu ${mainOrderCode}`,
            system_code: systemCode,
            system_type: systemCode
        }).select().single()

        if (pnkErr) throw pnkErr

        await (supabase.from('inbound_order_items') as any).insert({
            order_id: pnk.id,
            product_id: productId,
            product_name: productName,
            unit: reqUnit,
            quantity: Number((baseToBreak * rate).toFixed(6)),
            price: costPrice || 0
        })

        return baseToBreak
    },

    /**
     * Synchronizes physical LOT items with the accounting conversion.
     * Subtracts base units and adds requested units to the LOTs physically.
     */
    async syncPhysicalUnbundle(params: {
        supabase: SupabaseClient
        lotIds: string[]
        productId: string
        baseUnit: string
        reqUnit: string
        baseToBreak: number
        rate: number
    }) {
        const { supabase, lotIds, productId, baseUnit, reqUnit, baseToBreak, rate } = params
        if (baseToBreak <= 0) return

        // 1. Fetch relevant lot_items in those LOTs that have the base unit
        const { data: items, error: fetchErr } = await supabase
            .from('lot_items')
            .select('id, lot_id, quantity, unit')
            .in('lot_id', lotIds)
            .eq('product_id', productId)
            .eq('unit', baseUnit)

        if (fetchErr || !items || items.length === 0) {
            console.warn('[Physical Unbundle] No physical items found in base unit to break', { lotIds, productId, baseUnit })
            return
        }

        let remainingToBreak = baseToBreak

        for (const item of items) {
            if (remainingToBreak <= 0) break

            const canTake = Math.min(item.quantity, remainingToBreak)
            const newQty = item.quantity - canTake

            // Subtract from current item
            if (newQty <= 0.000001) {
                await supabase.from('lot_items').delete().eq('id', item.id)
            } else {
                await supabase.from('lot_items').update({ quantity: newQty } as any).eq('id', item.id)
            }

            // Add converted units to the SAME LOT
            const addedQty = canTake * rate
            // check if there's already an item with reqUnit in this LOT
            const { data: existing } = await supabase
                .from('lot_items')
                .select('id, quantity')
                .eq('lot_id', item.lot_id)
                .eq('product_id', productId)
                .eq('unit', reqUnit)
                .maybeSingle()

            if (existing) {
                await supabase.from('lot_items').update({ quantity: (existing.quantity || 0) + addedQty } as any).eq('id', existing.id)
            } else {
                await supabase.from('lot_items').insert({
                    lot_id: item.lot_id,
                    product_id: productId,
                    quantity: addedQty,
                    unit: reqUnit
                } as any)
            }

            // Update LOT total quantity (for consistency in summary list)
            const { data: allItems } = await supabase.from('lot_items').select('quantity').eq('lot_id', item.lot_id)
            const total = allItems?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0
            await supabase.from('lots').update({ quantity: total } as any).eq('id', item.lot_id)

            remainingToBreak -= canTake
        }
    }
}
