import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Database } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies()

        const authHeader = request.headers.get('Authorization')

        const supabase = createServerClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        cookieStore.set({ name, value, ...options })
                    },
                    remove(name: string, options: CookieOptions) {
                        cookieStore.set({ name, value: '', ...options })
                    },
                },
                global: {
                    headers: authHeader ? { Authorization: authHeader } : {}
                }
            }
        )
        const { searchParams } = new URL(request.url)
        const systemParam = searchParams.get('systemType')
        const systemType = systemParam || cookieStore.get('systemType')?.value || 'FROZEN'

        const q = searchParams.get('q')?.toLowerCase()
        const warehouse = searchParams.get('warehouse')
        const from = searchParams.get('dateFrom')
        const to = searchParams.get('dateTo')

        const convertToKg = searchParams.get('convertToKg') === 'true'

        // 1. Fetch Inbound items (Status = 'Completed')
        let inboundQuery = supabase
            .from('inbound_order_items')
            .select(`
                product_id,
                product_name,
                unit,
                quantity,
                order:inbound_orders!inner (
                    status,
                    warehouse_name,
                    created_at,
                    system_code
                )
            `)
            .eq('order.status', 'Completed')
            .eq('order.system_code', systemType)

        if (warehouse && warehouse !== 'Tất cả') {
            inboundQuery = inboundQuery.eq('order.warehouse_name', warehouse)
        }

        if (to) {
            inboundQuery = inboundQuery.lte('order.created_at', `${to} 23:59:59`)
        }

        const { data: inboundItems, error: inboundError } = await inboundQuery

        if (inboundError) throw inboundError

        // 2. Fetch Outbound items (Status = 'Completed')
        let outboundQuery = supabase
            .from('outbound_order_items')
            .select(`
                product_id,
                product_name,
                unit,
                quantity,
                order:outbound_orders!inner (
                    status,
                    warehouse_name,
                    created_at,
                    system_code
                )
            `)
            .eq('order.status', 'Completed')
            .eq('order.system_code', systemType)

        if (warehouse && warehouse !== 'Tất cả') {
            outboundQuery = outboundQuery.eq('order.warehouse_name', warehouse)
        }

        if (to) {
            outboundQuery = outboundQuery.lte('order.created_at', `${to} 23:59:59`)
        }

        const { data: outboundItems, error: outboundError } = await outboundQuery

        if (outboundError) throw outboundError

        // 3. Aggregate Data
        interface InventoryItem {
            productId: string
            productCode: string
            productName: string
            warehouse: string
            unit: string
            opening: number
            qtyIn: number
            qtyOut: number
            balance: number
            isUnconvertible?: boolean
        }

        // Fetch product info and conversion data if needed
        const { data: productsData } = await supabase.from('products').select('*')
        const { data: unitsData } = await supabase.from('units').select('*')
        const { data: prodUnitsData } = await supabase.from('product_units').select('*')

        // Maps for O(1) Access
        const productMap = new Map<string, any>()
            ; (productsData as any[])?.forEach(p => productMap.set(p.id, p))

        const unitNameMap = new Map<string, string>() // Name -> ID
        const unitIdMap = new Map<string, string>()   // ID -> Name
            ; (unitsData as any[])?.forEach(u => {
                unitNameMap.set(u.name.toLowerCase(), u.id)
                unitIdMap.set(u.id, u.name)
            })

        // Product Units Map: ProductID -> UnitID -> Rate (to Base)
        const conversionMap = new Map<string, Map<string, number>>()
            ; (prodUnitsData as any[])?.forEach(pu => {
                if (!conversionMap.has(pu.product_id)) {
                    conversionMap.set(pu.product_id, new Map())
                }
                conversionMap.get(pu.product_id)!.set(pu.unit_id, pu.conversion_rate)
            })

        const inventoryMap = new Map<string, InventoryItem>()

        // Helper: Convert any unit to Base Unit amount
        const toBaseAmount = (pid: string, unitName: string | null, qty: number): number => {
            if (!pid || !unitName) return qty
            const prod = productMap.get(pid)
            if (!prod) return qty

            // If unit is Base Unit, return qty
            if (prod.unit && prod.unit.toLowerCase() === unitName.toLowerCase()) return qty

            // Look up unit ID
            const uid = unitNameMap.get(unitName.toLowerCase())
            if (!uid) return qty // Unknown unit, treat as 1:1 fallback (or error)

            // Look up rate
            const rates = conversionMap.get(pid)
            if (rates && rates.has(uid)) {
                return qty * rates.get(uid)!
            }

            return qty
        }

        // Helper: Get Product's KG conversion rate (How many KG in 1 Base Unit?)
        // If Base is KG, return 1.
        // If 1 KG = X Base (from table), then 1 Base = 1/X KG.
        const getBaseToKgRate = (pid: string): number | null => {
            const prod = productMap.get(pid)
            if (!prod) return null

            const kgNames = ['kg', 'kilogram', 'ki-lo-gam', 'kgs']

            // Check Base Unit
            if (prod.unit && kgNames.includes(prod.unit.toLowerCase())) return 1

            // Check Product Units for a KG entry
            // Table stores: 1 Alt = rate * Base.
            // So if Alt is KG: 1 KG = rate * Base. -> 1 Base = 1/rate KG.
            const rates = conversionMap.get(pid)
            if (!rates) return null

            for (const name of kgNames) {
                const uid = unitNameMap.get(name)
                if (uid && rates.has(uid)) {
                    const rateKgToBase = rates.get(uid)!
                    if (rateKgToBase === 0) return null
                    return 1 / rateKgToBase
                }
            }

            return null
        }

        const processItem = (item: any, type: 'in' | 'out', date: Date) => {
            const isBeforePeriod = from ? date < new Date(from) : false
            const isAfterPeriod = to ? date > new Date(to + 'T23:59:59') : false
            if (isAfterPeriod) return

            const pid = item.product_id || 'unknown'
            const wName = item.order.warehouse_name || 'Unknown'
            const uName = item.unit || ''

            let key = ''
            let quantity = item.quantity
            let unitDisplay = uName
            let isUnconvertible = false

            if (convertToKg) {
                // Determine if convertible
                const baseToKgParams = getBaseToKgRate(pid)

                if (baseToKgParams !== null) {
                    // CONVERTIBLE
                    key = `${pid}_${wName}_Kg`
                    unitDisplay = 'Kg'

                    // 1. Convert Transaction Qty to Base Qty
                    const baseQty = toBaseAmount(pid, uName, quantity)
                    // 2. Convert Base Qty to KG Qty
                    quantity = baseQty * baseToKgParams

                } else {
                    // UNCONVERTIBLE - Keep separate
                    key = `${pid}_${wName}_${uName}_UNCONVERTIBLE`
                    isUnconvertible = true
                }
            } else {
                // NORMAL MODE
                key = `${pid}_${wName}_${uName}`
            }

            if (!inventoryMap.has(key)) {
                const prod = productMap.get(pid)
                inventoryMap.set(key, {
                    productId: pid,
                    productCode: prod?.sku || 'N/A',
                    productName: prod?.name || item.product_name || 'Unknown',
                    warehouse: wName,
                    unit: unitDisplay,
                    opening: 0,
                    qtyIn: 0,
                    qtyOut: 0,
                    balance: 0,
                    isUnconvertible
                })
            }

            const entry = inventoryMap.get(key)!

            if (isBeforePeriod) {
                if (type === 'in') entry.opening += quantity
                else entry.opening -= quantity // Outbound reduces opening balance? No.
                // Logic check: Opening Balance = Sum(In before) - Sum(Out before)
                // If this item is IN before period: Opening increases.
                // If this item is OUT before period: Opening decreases.
            } else {
                if (type === 'in') entry.qtyIn += quantity
                else entry.qtyOut += quantity
            }

            // Balance always affected
            if (type === 'in') entry.balance += quantity
            else entry.balance -= quantity
        }

            // Process Inbound
            ; (inboundItems as any[])?.forEach(item => processItem(item, 'in', new Date(item.order.created_at)))

            // Process Outbound
            ; (outboundItems as any[])?.forEach(item => processItem(item, 'out', new Date(item.order.created_at)))

        // Filter and Sort
        let result = Array.from(inventoryMap.values())
        if (q) {
            result = result.filter(i =>
                i.productCode.toLowerCase().includes(q) ||
                i.productName.toLowerCase().includes(q) ||
                i.productId === q
            )
        }

        // Sort: Convertible/Normal first, Unconvertible last
        result.sort((a, b) => {
            if (a.isUnconvertible && !b.isUnconvertible) return 1
            if (!a.isUnconvertible && b.isUnconvertible) return -1
            return a.productName.localeCompare(b.productName)
        })

        return NextResponse.json({ ok: true, items: result })
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        )
    }
}

