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
