import { SupabaseClient } from '@supabase/supabase-js'
import { lotService } from '@/services/warehouse/lotService'
import { enrichUnitName, ConversionMap, UnitNameMap, convertUnit } from '@/lib/unitConversion'

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
    conversionMap: ConversionMap
    unitNameMap: UnitNameMap
    unitIdMap: Map<string, string>
    generateOrderCode: (type: 'PNK' | 'PXK') => Promise<string>
    categoryId?: string | null
    productBaseUnit?: string | null
}

export interface BundleParams {
    supabase: SupabaseClient
    productId: string
    productName: string
    sourceUnit: string
    targetUnit: string
    sourceQty: number
    targetQty: number
    costPrice: number
    rate: number
    warehouseName: string
    systemCode: string
    mainOrderCode: string
    convTypeId?: string
    conversionMap: ConversionMap
    unitNameMap: UnitNameMap
    unitIdMap: Map<string, string>
    generateOrderCode: (type: 'PNK' | 'PXK') => Promise<string>
    categoryId?: string | null
    productBaseUnit?: string | null
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
        unitIdMap: Map<string, string>
        conversionMap: Map<string, Map<string, number>>
        unitStockMap: Map<string, number>
    }): { needsUnbundle: boolean, unbundleInfo?: string, sourceUnit?: string, rate?: number } {
        const { productId, unit, qty, products, units, unitNameMap, unitIdMap, conversionMap, unitStockMap } = params
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
                        const enrichedBase = enrichUnitName(productId, product.unit, conversionMap, unitNameMap, unitIdMap, product.unit)
                        const enrichedReq = enrichUnitName(productId, unit, conversionMap, unitNameMap, unitIdMap, product.unit)
                        return {
                            needsUnbundle: true,
                            unbundleInfo: `Tự động: Bẻ ${baseToBreak} ${enrichedBase} -> ${(baseToBreak * rateBaseToReq).toFixed(2).replace(/\.00$/, '')} ${enrichedReq}`,
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
                        const enrichedBase = enrichUnitName(productId, altUnitName, conversionMap, unitNameMap, unitIdMap, product.unit)
                        const enrichedReq = enrichUnitName(productId, unit, conversionMap, unitNameMap, unitIdMap, product.unit)
                        return {
                            needsUnbundle: true,
                            unbundleInfo: `Tự động: Bẻ ${altToBreak} ${enrichedBase} -> ${(altToBreak * rateAltToReq).toFixed(2).replace(/\.00$/, '')} ${enrichedReq}`,
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
     * Processes a list of items to identify and mark those that require unbundling.
     */
    processUnbundle(
        items: any[],
        products: any[],
        units: any[],
        unitNameMap: Map<string, string>,
        unitIdMap: Map<string, string>,
        conversionMap: Map<string, Map<string, number>>,
        unitStockMap: Map<string, number>
    ): { processed: any[], unbundledCount: number } {
        let unbundledCount = 0
        const processed = items.map(item => {
            const { needsUnbundle, unbundleInfo, sourceUnit, rate } = this.checkUnbundle({
                productId: item.productId,
                unit: item.unit,
                qty: item.quantity,
                products,
                units,
                unitNameMap,
                unitIdMap,
                conversionMap,
                unitStockMap
            })

            if (needsUnbundle) {
                unbundledCount++
                return { 
                    ...item, 
                    needsUnbundle: true, 
                    unbundleMeta: { sourceUnit, rate, unbundleInfo } 
                }
            }
            return item
        })

        return { processed, unbundledCount }
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
            mainOrderCode, convTypeId, conversionMap, unitNameMap, unitIdMap, generateOrderCode, categoryId, productBaseUnit
        } = params

        const deficit = reqQty - currentLiquid
        const baseToBreak = Math.ceil(deficit / rate - 0.000001)

        if (baseToBreak <= 0) return null

        // Enrich Unit Names for Orders (use productBaseUnit to respect product unit domain)
        const enrichedBaseUnit = enrichUnitName(productId, baseUnit, conversionMap, unitNameMap, unitIdMap, productBaseUnit)
        const enrichedReqUnit = enrichUnitName(productId, reqUnit, conversionMap, unitNameMap, unitIdMap, productBaseUnit)

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
            unit: enrichedBaseUnit,
            quantity: Number(baseToBreak.toFixed(6)),
            price: costPrice || 0,
            category_id: categoryId || null
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
            unit: enrichedReqUnit,
            quantity: Number((baseToBreak * rate).toFixed(6)),
            price: costPrice || 0,
            category_id: categoryId || null
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
        const { data: allLotItems, error: fetchErr } = await supabase
            .from('lot_items')
            .select('id, lot_id, quantity, unit, category_id')
            .in('lot_id', lotIds)
            .eq('product_id', productId)

        if (fetchErr || !allLotItems || allLotItems.length === 0) {
            console.warn('[Physical Unbundle] No physical items found in lot to break', { lotIds, productId, baseUnit })
            return
        }

        const normBase = (baseUnit || '').toLowerCase().trim()
        const stripBase = normBase.replace(/\s*\([^)]*\)/g, '').trim()
        const items = allLotItems.filter(i => {
            const n = (i.unit || '').toLowerCase().trim()
            return n === normBase || n.replace(/\s*\([^)]*\)/g, '').trim() === stripBase
        })

        if (items.length === 0) {
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
            const normReq = (reqUnit || '').toLowerCase().trim()
            const stripReq = normReq.replace(/\s*\([^)]*\)/g, '').trim()

            // check if there's already an item with reqUnit in this LOT
            const existing = allLotItems.find(i => {
                if (i.lot_id !== item.lot_id) return false
                const n = (i.unit || '').toLowerCase().trim()
                return n === normReq || n.replace(/\s*\([^)]*\)/g, '').trim() === stripReq
            })

            if (existing) {
                await supabase.from('lot_items').update({ quantity: (existing.quantity || 0) + addedQty } as any).eq('id', existing.id)
            } else {
                await supabase.from('lot_items').insert({
                    lot_id: item.lot_id,
                    product_id: productId,
                    quantity: addedQty,
                    unit: reqUnit,
                    category_id: item.category_id ?? null
                } as any)
            }

            // Update LOT total quantity and status
            await lotService.syncLotStatus({
                supabase,
                lotId: item.lot_id,
                isSiteIssuance: false // Unbundle is internal
            })

            remainingToBreak -= canTake
        }
    },

    /**
     * Checks if a product needs bundling (gộp lẻ) to fulfill a requested large unit.
     * Example: Requested 1 Thùng (15kg), stock of Thùng is 0, but stock of kg is 40.
     * Returns metadata about the bundle operation if needed.
     */
    checkBundle(params: {
        productId: string
        unit: string
        qty: number
        products: any[]
        units: any[]
        unitNameMap: Map<string, string>
        unitIdMap: Map<string, string>
        conversionMap: Map<string, Map<string, number>>
        unitStockMap: Map<string, number>
    }): { needsBundle: boolean, bundleInfo?: string, sourceUnit?: string, sourceQty?: number, targetQty?: number, rate?: number } {
        const { productId, unit, qty, products, units, unitNameMap, unitIdMap, conversionMap, unitStockMap } = params
        const product = products.find(p => p.id === productId)
        if (!product || !unit) return { needsBundle: false }

        const normalize = (s: string) => s.normalize('NFC').toLowerCase().trim()
        const strip = (s: string) => s.replace(/\s*\([^)]*\)/g, '').trim()

        const normReqUnit = normalize(unit)
        const strippedReqUnit = strip(normReqUnit)

        const getStockByUnit = (targetUnit: string) => {
            const nTarget = normalize(targetUnit)
            const sTarget = strip(nTarget)

            // 1. Exact match
            let val = unitStockMap.get(`${productId}_${nTarget}`)
            if (val !== undefined) return val

            // 2. Fuzzy match
            for (const [key, q] of unitStockMap.entries()) {
                if (!key.startsWith(`${productId}_`)) continue
                const unitPart = key.split(`${productId}_`)[1]
                if (strip(unitPart) === sTarget) return q
            }
            return 0
        }

        // 1. Check direct liquid stock of requested unit
        const currentLiquid = getStockByUnit(unit)
        if (currentLiquid >= qty - 0.000001) return { needsBundle: false }

        const deficit = qty - currentLiquid // Number of target units needed (e.g. 1 Thùng)
        const baseUnitName = product.unit || ''
        const normBaseName = normalize(baseUnitName)
        const strippedBaseName = strip(normBaseName)

        // Helper to check conversion rate from target unit (unit) to candidate source unit
        const getSourcePerTargetRate = (sourceCandidate: string): number => {
            // Priority 1: Check weight in name, e.g. "Thùng (15kg)" vs "kg"
            const pRateTarget = this.parseRateFromName(unit)
            const pRateSource = this.parseRateFromName(sourceCandidate)
            if (pRateTarget !== null) {
                const sRate = pRateSource || 1
                return pRateTarget / sRate
            }

            // Priority 2: Use convertUnit
            return convertUnit(
                productId,
                unit,
                sourceCandidate,
                1,
                baseUnitName,
                unitNameMap,
                conversionMap
            )
        }

        // Candidate 1: Check base unit if it differs from requested unit
        if (normReqUnit !== normBaseName && strippedReqUnit !== strippedBaseName) {
            const currentBase = getStockByUnit(baseUnitName)
            if (currentBase > 0) {
                const sourcePerTarget = getSourcePerTargetRate(baseUnitName)
                if (sourcePerTarget && sourcePerTarget > 1.000001) {
                    // Only bundle if candidate source unit is smaller than target unit (sourcePerTarget > 1)
                    const targetsToMake = Math.ceil(deficit - 0.000001)
                    const sourceNeeded = Number((targetsToMake * sourcePerTarget).toFixed(6))

                    if (currentBase >= sourceNeeded - 0.000001) {
                        const enrichedSource = enrichUnitName(productId, baseUnitName, conversionMap, unitNameMap, unitIdMap, product.unit)
                        const enrichedTarget = enrichUnitName(productId, unit, conversionMap, unitNameMap, unitIdMap, product.unit)
                        return {
                            needsBundle: true,
                            bundleInfo: `Tự động: Gộp ${sourceNeeded} ${enrichedSource} -> ${targetsToMake} ${enrichedTarget}`,
                            sourceUnit: baseUnitName,
                            sourceQty: sourceNeeded,
                            targetQty: targetsToMake,
                            rate: sourcePerTarget
                        }
                    }
                }
            }
        }

        // Candidate 2: Check alt units in product_units
        for (const pu of product.product_units || []) {
            const altUnitName = units.find(u => u.id === pu.unit_id)?.name
            if (!altUnitName) continue
            const normAltUnit = normalize(altUnitName)
            const strippedAltUnit = strip(normAltUnit)

            if (normAltUnit === normReqUnit || strippedAltUnit === strippedReqUnit) continue

            const currentAlt = getStockByUnit(altUnitName)
            if (currentAlt > 0) {
                const sourcePerTarget = getSourcePerTargetRate(altUnitName)
                if (sourcePerTarget && sourcePerTarget > 1.000001) {
                    const targetsToMake = Math.ceil(deficit - 0.000001)
                    const sourceNeeded = Number((targetsToMake * sourcePerTarget).toFixed(6))

                    if (currentAlt >= sourceNeeded - 0.000001) {
                        const enrichedSource = enrichUnitName(productId, altUnitName, conversionMap, unitNameMap, unitIdMap, product.unit)
                        const enrichedTarget = enrichUnitName(productId, unit, conversionMap, unitNameMap, unitIdMap, product.unit)
                        return {
                            needsBundle: true,
                            bundleInfo: `Tự động: Gộp ${sourceNeeded} ${enrichedSource} -> ${targetsToMake} ${enrichedTarget}`,
                            sourceUnit: altUnitName,
                            sourceQty: sourceNeeded,
                            targetQty: targetsToMake,
                            rate: sourcePerTarget
                        }
                    }
                }
            }
        }

        return { needsBundle: false }
    },

    /**
     * Processes a list of items to identify and mark those that require bundling (gộp lẻ).
     */
    processBundle(
        items: any[],
        products: any[],
        units: any[],
        unitNameMap: Map<string, string>,
        unitIdMap: Map<string, string>,
        conversionMap: Map<string, Map<string, number>>,
        unitStockMap: Map<string, number>
    ): { processed: any[], bundledCount: number } {
        let bundledCount = 0
        const processed = items.map(item => {
            const { needsBundle, bundleInfo, sourceUnit, sourceQty, targetQty, rate } = this.checkBundle({
                productId: item.productId,
                unit: item.unit,
                qty: item.quantity,
                products,
                units,
                unitNameMap,
                unitIdMap,
                conversionMap,
                unitStockMap
            })

            if (needsBundle) {
                bundledCount++
                return { 
                    ...item, 
                    needsBundle: true, 
                    bundleMeta: { sourceUnit, sourceQty, targetQty, rate, bundleInfo } 
                }
            }
            return item
        })

        return { processed, bundledCount }
    },

    /**
     * Executes the Auto-Bundle process:
     * 1. Creates a Conversion Outbound Order (PXK) to remove smaller units (e.g. 15 kg).
     * 2. Creates a Conversion Inbound Order (PNK) to add converted large units (e.g. 1 Thùng).
     */
    async executeAutoBundle(params: BundleParams) {
        const {
            supabase, productId, productName, sourceUnit, targetUnit, sourceQty, targetQty,
            costPrice, rate, warehouseName, systemCode, mainOrderCode, convTypeId,
            conversionMap, unitNameMap, unitIdMap, generateOrderCode, categoryId, productBaseUnit
        } = params

        if (sourceQty <= 0 || targetQty <= 0) return null

        // Enrich Unit Names for Orders
        const enrichedSourceUnit = enrichUnitName(productId, sourceUnit, conversionMap, unitNameMap, unitIdMap, productBaseUnit)
        const enrichedTargetUnit = enrichUnitName(productId, targetUnit, conversionMap, unitNameMap, unitIdMap, productBaseUnit)

        // A. Create PXK (Chuyển đổi) - Out Smaller Units
        const pxkCode = await generateOrderCode('PXK')
        const { data: pxk, error: pxkErr } = await (supabase.from('outbound_orders') as any).insert({
            code: pxkCode + '-AUTO',
            status: 'Completed',
            type: 'Conversion',
            order_type_id: convTypeId,
            warehouse_name: warehouseName,
            description: `Tự động gộp lẻ cho phiếu ${mainOrderCode}`,
            system_code: systemCode,
            system_type: systemCode
        }).select().single()

        if (pxkErr) throw pxkErr

        await (supabase.from('outbound_order_items') as any).insert({
            order_id: pxk.id,
            product_id: productId,
            product_name: productName,
            unit: enrichedSourceUnit,
            quantity: Number(sourceQty.toFixed(6)),
            price: costPrice || 0,
            category_id: categoryId || null
        })

        // B. Create PNK (Chuyển đổi) - In Large Units
        const pnkCode = await generateOrderCode('PNK')
        const { data: pnk, error: pnkErr } = await (supabase.from('inbound_orders') as any).insert({
            code: pnkCode + '-AUTO',
            status: 'Completed',
            type: 'Conversion',
            order_type_id: convTypeId,
            warehouse_name: warehouseName,
            description: `Tự động gộp lẻ cho phiếu ${mainOrderCode}`,
            system_code: systemCode,
            system_type: systemCode
        }).select().single()

        if (pnkErr) throw pnkErr

        await (supabase.from('inbound_order_items') as any).insert({
            order_id: pnk.id,
            product_id: productId,
            product_name: productName,
            unit: enrichedTargetUnit,
            quantity: Number(targetQty.toFixed(6)),
            price: costPrice || 0,
            category_id: categoryId || null
        })

        return { sourceQty, targetQty }
    },

    /**
     * Synchronizes physical LOT items with the accounting bundle conversion.
     * Subtracts smaller units and adds bundled large units to the LOTs physically.
     */
    async syncPhysicalBundle(params: {
        supabase: SupabaseClient
        lotIds: string[]
        productId: string
        sourceUnit: string
        targetUnit: string
        sourceQty: number
        targetQty: number
    }) {
        const { supabase, lotIds, productId, sourceUnit, targetUnit, sourceQty, targetQty } = params
        if (sourceQty <= 0 || targetQty <= 0) return

        // 1. Fetch relevant lot_items in those LOTs that have the source unit
        const { data: allLotItems, error: fetchErr } = await supabase
            .from('lot_items')
            .select('id, lot_id, quantity, unit, category_id')
            .in('lot_id', lotIds)
            .eq('product_id', productId)

        if (fetchErr || !allLotItems || allLotItems.length === 0) {
            console.warn('[Physical Bundle] No physical items found in lot to bundle', { lotIds, productId, sourceUnit })
            return
        }

        const normSource = (sourceUnit || '').toLowerCase().trim()
        const stripSource = normSource.replace(/\s*\([^)]*\)/g, '').trim()
        const items = allLotItems.filter(i => {
            const n = (i.unit || '').toLowerCase().trim()
            return n === normSource || n.replace(/\s*\([^)]*\)/g, '').trim() === stripSource
        })

        if (items.length === 0) {
            console.warn('[Physical Bundle] No physical items found in source unit to bundle', { lotIds, productId, sourceUnit })
            return
        }

        let remainingSource = sourceQty

        for (const item of items) {
            if (remainingSource <= 0) break

            const canTake = Math.min(item.quantity, remainingSource)
            const newQty = item.quantity - canTake

            // Subtract from current item
            if (newQty <= 0.000001) {
                await supabase.from('lot_items').delete().eq('id', item.id)
            } else {
                await supabase.from('lot_items').update({ quantity: newQty } as any).eq('id', item.id)
            }

            // Calculate portion of target to add to this lot
            const targetToAdd = (canTake / sourceQty) * targetQty
            const normTarget = (targetUnit || '').toLowerCase().trim()
            const stripTarget = normTarget.replace(/\s*\([^)]*\)/g, '').trim()

            // check if there's already an item with targetUnit in this LOT
            const existing = allLotItems.find(i => {
                if (i.lot_id !== item.lot_id) return false
                const n = (i.unit || '').toLowerCase().trim()
                return n === normTarget || n.replace(/\s*\([^)]*\)/g, '').trim() === stripTarget
            })

            if (existing) {
                await supabase.from('lot_items').update({ quantity: (existing.quantity || 0) + targetToAdd } as any).eq('id', existing.id)
            } else {
                await supabase.from('lot_items').insert({
                    lot_id: item.lot_id,
                    product_id: productId,
                    quantity: targetToAdd,
                    unit: targetUnit,
                    category_id: item.category_id ?? null
                } as any)
            }

            // Update LOT total quantity and status
            await lotService.syncLotStatus({
                supabase,
                lotId: item.lot_id,
                isSiteIssuance: false
            })

            remainingSource -= canTake
        }
    }
}
