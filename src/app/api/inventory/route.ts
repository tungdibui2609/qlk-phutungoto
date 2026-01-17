import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Database } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies()

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
            }
        )
        const { searchParams } = new URL(request.url)

        const q = searchParams.get('q')?.toLowerCase()
        const warehouse = searchParams.get('warehouse')
        const from = searchParams.get('dateFrom')
        const to = searchParams.get('dateTo')

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
                    created_at
                )
            `)
            .eq('order.status', 'Completed')

        if (warehouse && warehouse !== 'Tất cả') {
            inboundQuery = inboundQuery.eq('order.warehouse_name', warehouse)
        }

        if (to) {
            inboundQuery = inboundQuery.lte('order.created_at', `${to} 23:59:59`)
        }

        const { data: inboundItems, error: inboundError } = await inboundQuery

        console.log('Invariant Check:', {
            q, warehouse, from, to
        })
        console.log('Inbound Items Fetch:', {
            count: inboundItems?.length,
            error: inboundError,
            firstStatus: (inboundItems?.[0] as any)?.order?.status
        })

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
                    created_at
                )
            `)
            .eq('order.status', 'Completed')

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
        }

        // Fetch basic product info for mapping codes
        const { data: products } = await supabase.from('products').select('id, sku, name')
        const productMap = new Map<string, { sku: string, name: string }>()
            ; (products as any[])?.forEach(p => {
                productMap.set(p.id, { sku: p.sku, name: p.name })
            })

        const inventoryMap = new Map<string, InventoryItem>()

        const getOrCreateItem = (productId: string | null, warehouseName: string | null, unit: string | null, name: string | null) => {
            const pId = productId || 'unknown'
            const wName = warehouseName || 'Unknown'
            const u = unit || ''

            const key = `${pId}_${wName}_${u}`
            if (!inventoryMap.has(key)) {
                const prod = productMap.get(pId)
                inventoryMap.set(key, {
                    productId: pId,
                    productCode: prod?.sku || 'N/A',
                    productName: prod?.name || name || 'Unknown',
                    warehouse: wName,
                    unit: u,
                    opening: 0,
                    qtyIn: 0,
                    qtyOut: 0,
                    balance: 0
                })
            }

            return inventoryMap.get(key)!
        };

        // Process Inbound
        // Type assertion for the joined result structure
        type OrderItemWithOrder = {
            product_id: string | null
            product_name: string | null
            unit: string | null
            quantity: number
            order: {
                created_at: string
                warehouse_name: string | null
                status: string | null
            } | null // It is actually !inner so not null, but TS check
        }

            ; (inboundItems as unknown as OrderItemWithOrder[])?.forEach((item) => {
                if (!item.order) return

                const date = new Date(item.order.created_at)
                const isBeforePeriod = from ? date < new Date(from) : false
                const isAfterPeriod = to ? date > new Date(to + 'T23:59:59') : false

                if (isAfterPeriod) return

                const entry = getOrCreateItem(item.product_id, item.order.warehouse_name, item.unit, item.product_name)

                if (isBeforePeriod) {
                    entry.opening += item.quantity
                } else {
                    entry.qtyIn += item.quantity
                }
                entry.balance += item.quantity
            })

            // Process Outbound
            ; (outboundItems as unknown as OrderItemWithOrder[])?.forEach((item) => {
                if (!item.order) return

                const date = new Date(item.order.created_at)
                const isBeforePeriod = from ? date < new Date(from) : false
                const isAfterPeriod = to ? date > new Date(to + 'T23:59:59') : false

                if (isAfterPeriod) return

                const entry = getOrCreateItem(item.product_id, item.order.warehouse_name, item.unit, item.product_name)

                if (isBeforePeriod) {
                    entry.opening -= item.quantity
                } else {
                    entry.qtyOut += item.quantity
                }
                entry.balance -= item.quantity
            })

        // Filter by Query
        let result = Array.from(inventoryMap.values())
        if (q) {
            result = result.filter(i =>
                i.productCode.toLowerCase().includes(q) ||
                i.productName.toLowerCase().includes(q) ||
                i.productId === q
            )
        }

        return NextResponse.json({ ok: true, items: result })
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error.message },
            { status: 500 }
        )
    }
}

