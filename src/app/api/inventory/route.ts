import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Database } from '@/lib/database.types'
import { toBaseAmount as toBaseAmountLogic, getBaseToKgRate as getBaseToKgRateLogic, convertUnit as convertUnitLogic } from '@/lib/unitConversion'

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
        const targetUnitId = searchParams.get('targetUnitId')
        const targetUnit = targetUnitId ? (unitsData as any[])?.find(u => u.id === targetUnitId) : null

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

            const prod = productMap.get(pid)
            const baseUnitName = prod?.unit || null

            // Determine if convertible
            const isConvertible = targetUnitId && prod && (
                baseUnitName?.toLowerCase() === targetUnit?.name?.toLowerCase() ||
                conversionMap.get(pid)?.has(targetUnitId)
            )

            if (targetUnitId && isConvertible) {
                // CONVERTIBLE
                key = `${pid}_${wName}_${targetUnitId}`
                unitDisplay = targetUnit.name
                quantity = convertUnitLogic(pid, uName, targetUnit.name, quantity, baseUnitName, unitNameMap, conversionMap)
            } else {
                // NOT CONVERTIBLE or NO TARGET UNIT
                key = `${pid}_${wName}_${uName}`
                if (targetUnitId) {
                    isUnconvertible = true
                }
            }

            if (!inventoryMap.has(key)) {
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

