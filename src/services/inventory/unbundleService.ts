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

        const normReqUnit = unit.toLowerCase().trim()

        // 1. Check direct liquid stock
        // Note: unitStockMap keys are formatted as "productId_unitname"
        const currentLiquid = unitStockMap.get(`${productId}_${normReqUnit}`) || 0
        if (currentLiquid >= qty - 0.000001) return { needsUnbundle: false }

        const deficit = qty - currentLiquid
        const baseUnitName = (product.unit || '').toLowerCase().trim()

        // Case 1: Break Base Unit (Official Unit)
        if (normReqUnit !== baseUnitName) {
            const currentBase = unitStockMap.get(`${productId}_${baseUnitName}`) || 0
            if (currentBase > 0) {
                const rUnitId = unitNameMap.get(normReqUnit)
                const rateReqStackToBase = conversionMap.get(productId)?.get(rUnitId || '') || 0

                if (rateReqStackToBase > 0) {
                    const rateBaseToReq = 1 / rateReqStackToBase
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
            const normAltUnit = altUnitName.toLowerCase().trim()

            if (normAltUnit === normReqUnit) continue

            const currentAlt = unitStockMap.get(`${productId}_${normAltUnit}`) || 0
            if (currentAlt > 0) {
                const altToBase = pu.conversion_rate
                const reqUnitId = unitNameMap.get(normReqUnit)
                const reqToBase = normReqUnit === baseUnitName ? 1 : (conversionMap.get(productId)?.get(reqUnitId || '') || 1)

                const rateAltToReq = altToBase / reqToBase

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
    }
}
