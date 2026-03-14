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

        const q = searchParams.get('q')
        const searchMode = searchParams.get('searchMode') || 'all'
        const warehouse = searchParams.get('warehouse')
        const from = searchParams.get('dateFrom')
        const to = searchParams.get('dateTo')

        const convertToKg = searchParams.get('convertToKg') === 'true'

        // 1. Fetch ALL Inbound items (Status = 'Completed') using pagination
        let inboundItems: any[] = [];
        let inboundFrom = 0;
        const PAGE_SIZE = 1000;
        let inboundHasMore = true;

        while (inboundHasMore) {
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
                .range(inboundFrom, inboundFrom + PAGE_SIZE - 1);

            if (warehouse && warehouse !== 'Tất cả') {
                inboundQuery = inboundQuery.eq('order.warehouse_name', warehouse)
            }

            if (to) {
                inboundQuery = inboundQuery.lte('order.created_at', `${to} 23:59:59`)
            }

            const { data, error } = await inboundQuery;
            if (error) throw error;

            if (!data || data.length === 0) {
                inboundHasMore = false;
            } else {
                inboundItems = [...inboundItems, ...data];
                if (data.length < PAGE_SIZE) {
                    inboundHasMore = false;
                } else {
                    inboundFrom += PAGE_SIZE;
                }
            }
        }

        // 2. Fetch ALL Outbound items (Status = 'Completed') using pagination
        let outboundItems: any[] = [];
        let outboundFrom = 0;
        let outboundHasMore = true;

        while (outboundHasMore) {
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
                .range(outboundFrom, outboundFrom + PAGE_SIZE - 1);

            if (warehouse && warehouse !== 'Tất cả') {
                outboundQuery = outboundQuery.eq('order.warehouse_name', warehouse)
            }

            if (to) {
                outboundQuery = outboundQuery.lte('order.created_at', `${to} 23:59:59`)
            }

            const { data, error } = await outboundQuery;
            if (error) throw error;

            if (!data || data.length === 0) {
                outboundHasMore = false;
            } else {
                outboundItems = [...outboundItems, ...data];
                if (data.length < PAGE_SIZE) {
                    outboundHasMore = false;
                } else {
                    outboundFrom += PAGE_SIZE;
                }
            }
        }

        // 3. Aggregate Data
        interface InventoryItem {
            productId: string
            productCode: string
            productName: string
            internalCode?: string | null
            internalName?: string | null
            warehouse: string
            unit: string
            opening: number
            qtyIn: number
            qtyOut: number
            balance: number
            categoryName: string | null
            isUnconvertible?: boolean
        }

        // Fetch support data with pagination to bypass 1000 limit
        const fetchAllWithPagination = async (tableName: string) => {
            let allResults: any[] = [];
            let currentFrom = 0;
            const LIMIT = 1000;
            while (true) {
                const { data, error } = await supabase
                    .from(tableName as any)
                    .select('*')
                    .range(currentFrom, currentFrom + LIMIT - 1);
                if (error) throw error;
                if (!data || data.length === 0) break;
                allResults = [...allResults, ...data];
                if (data.length < LIMIT) break;
                currentFrom += LIMIT;
            }
            return allResults;
        };

        const productsData = await fetchAllWithPagination('products');
        const unitsData = await fetchAllWithPagination('units');
        const prodUnitsData = await fetchAllWithPagination('product_units');
        const categoriesData = await fetchAllWithPagination('categories');
        const lotsData = await fetchAllWithPagination('lots');
        const positionsData = await fetchAllWithPagination('positions');
        const lotTagsData = await fetchAllWithPagination('lot_tags');

        // Maps for O(1) Access
        const productMap = new Map<string, any>()
        ; (productsData as any[])?.forEach(p => productMap.set(p.id, p))

        const lotToPositions = new Map<string, any[]>()
        ; (positionsData as any[])?.forEach(p => {
            if (p.lot_id) {
                if (!lotToPositions.has(p.lot_id)) lotToPositions.set(p.lot_id, [])
                lotToPositions.get(p.lot_id)!.push(p)
            }
        })

        const lotToTags = new Map<string, string[]>()
        ; (lotTagsData as any[])?.forEach(t => {
            if (t.lot_id) {
                if (!lotToTags.has(t.lot_id)) lotToTags.set(t.lot_id, [])
                lotToTags.get(t.lot_id)!.push(t.tag)
            }
        })

        const lotMap = new Map<string, any>()
        ; (lotsData as any[])?.forEach(l => lotMap.set(l.id, l))

        const categoryMap = new Map<string, string>() // ID -> Name
        ; (categoriesData as any[])?.forEach(c => categoryMap.set(c.id, c.name))

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
                    internalCode: prod?.internal_code || null,
                    internalName: prod?.internal_name || null,
                    warehouse: wName,
                    unit: unitDisplay,
                    opening: 0,
                    qtyIn: 0,
                    qtyOut: 0,
                    balance: 0,
                    categoryName: prod?.category_id ? categoryMap.get(prod.category_id) || null : null,
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
        const matchSearch = (val: string | null | undefined, query: string) => {
            if (!query) return true
            if (!val) return false
            const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
            const nVal = normalize(val)
            
            const orParts = query.split(';').map(p => p.trim()).filter(Boolean)
            return orParts.some(orPart => {
                const andParts = orPart.split('&').map(p => p.trim()).filter(Boolean)
                return andParts.every(andPart => {
                    return nVal.includes(normalize(andPart))
                })
            })
        }

        if (q) {
            result = result.filter(i => {
                const prod = productMap.get(i.productId)
                const categoryName = prod?.category_id ? categoryMap.get(prod.category_id) || '' : ''
                
                // Find lots for this product in this warehouse to check tags/positions
                const relatedLots = (lotsData as any[]).filter(l => l.product_id === i.productId && l.warehouse_name === i.warehouse)
                const tags = relatedLots.flatMap(l => lotToTags.get(l.id) || [])
                const positions = relatedLots.flatMap(l => lotToPositions.get(l.id) || [])

                const checkName = matchSearch(i.productName, q) || matchSearch(i.internalName, q)
                const checkCode = matchSearch(i.productCode, q) || matchSearch(i.internalCode, q) || relatedLots.some(l => matchSearch(l.code, q))
                const checkCategory = matchSearch(categoryName, q)
                const checkTag = tags.some(t => matchSearch(t, q))
                const checkPos = positions.some(p => matchSearch(p.code, q))

                if (searchMode === 'name') return checkName
                if (searchMode === 'code') return checkCode
                if (searchMode === 'category') return checkCategory
                if (searchMode === 'tag') return checkTag
                if (searchMode === 'position') return checkPos
                
                return checkName || checkCode || checkCategory || checkTag || checkPos
            })
        }

        // 4. Filter by Category IDs if provided
        const categoryIdsParam = searchParams.get('categoryIds')
        if (categoryIdsParam) {
            const selectedCategoryIds = new Set(categoryIdsParam.split(',').filter(Boolean))
            if (selectedCategoryIds.size > 0) {
                result = result.filter(i => {
                    const prod = productMap.get(i.productId)
                    return prod?.category_id && selectedCategoryIds.has(prod.category_id)
                })
            }
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

