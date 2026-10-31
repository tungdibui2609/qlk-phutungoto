import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from "@/lib/database.types";
import { getServerSupabaseUrl, AUTH_COOKIE_NAME } from "@/lib/supabaseUrl";
import { convertUnit as convertUnitLogic, normalizeUnit, canonicalizeUnit, isKg, extractWeightFromName } from '@/lib/unitConversion'

export const dynamic = 'force-dynamic';

const NO_ORDER = 'Chưa gắn lệnh SX'
const NO_LOT = 'Không có mã lot SX'

interface ProductEntry {
    productCode: string
    productName: string
    quantity: number
    unit: string
    lotCodes: string[]
    isUnconvertible: boolean
}

interface LotEntry {
    lotCode: string
    productionDate: string | null
    products: Map<string, ProductEntry>
}

interface OrderEntry {
    orderCode: string
    orderName: string | null
    lots: Map<string, LotEntry>
}

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const authHeader = req.headers.get('Authorization')

        const supabase = createServerClient<Database>(
            getServerSupabaseUrl(),
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookieOptions: {
                    name: AUTH_COOKIE_NAME,
                },
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            )
                        } catch {}
                    },
                },
                global: {
                    headers: authHeader ? { Authorization: authHeader } : {}
                }
            }
        )

        const searchParams = req.nextUrl.searchParams;
        const warehouse = searchParams.get("warehouse") || "";
        const systemParam = searchParams.get('systemType')
        const systemType = systemParam || cookieStore.get('systemType')?.value || 'FROZEN'
        const targetUnitId = searchParams.get('targetUnitId')
        const q = searchParams.get('q')
        const searchMode = searchParams.get('searchMode') || 'all'

        let normalizedSystemType = systemType;
        if (systemType === 'FROZEN') normalizedSystemType = 'KHO_DONG_LANH';
        if (systemType === 'DRY') normalizedSystemType = 'KHO_VAT_TU_BAO_BI';

        const fetchAllWithPagination = async (tableName: string, selectCols: string) => {
            let allResults: any[] = [];
            let currentFrom = 0;
            const LIMIT = 1000;
            while (true) {
                const { data, error } = await supabase
                    .from(tableName as any)
                    .select(selectCols)
                    .order('id')
                    .range(currentFrom, currentFrom + LIMIT - 1);
                if (error) throw error;
                if (!data || data.length === 0) break;
                allResults = [...allResults, ...data];
                if (data.length < LIMIT) break;
                currentFrom += LIMIT;
            }
            return allResults;
        };

        const unitsData = await fetchAllWithPagination('units', 'id, name');
        const productsData = await fetchAllWithPagination('products', 'id, sku, name, unit');
        const prodUnitsData = await fetchAllWithPagination('product_units', 'product_id, unit_id, conversion_rate');

        // production_lots không có FK từ lots nên không embed được -> map thủ công theo id
        const productionsData = await fetchAllWithPagination('productions', 'id, code, name');
        const productionLotsData = await fetchAllWithPagination('production_lots', 'id, lot_code, production_date, production_id');

        const units = unitsData as any[]
        const targetUnit = targetUnitId ? units?.find(u => u.id === targetUnitId) : null

        const productMap = new Map<string, any>()
        productsData.forEach(p => productMap.set(p.id, p))

        const orderMap = new Map<string, any>()
        productionsData.forEach(p => orderMap.set(p.id, p))

        const prodLotMap = new Map<string, any>()
        productionLotsData.forEach(pl => prodLotMap.set(pl.id, pl))

        const unitNameMap = new Map<string, string>()
        const unitIdMap = new Map<string, string>()
        units.forEach(u => {
            const normalized = normalizeUnit(u.name)
            unitNameMap.set(normalized, u.id)
            unitIdMap.set(u.id, u.name)

            const withoutWeight = normalized.replace(/\s*\([^)]*\)/, '').trim()
            if (!unitNameMap.has(withoutWeight)) {
                unitNameMap.set(withoutWeight, u.id)
            }
        })

        const conversionMap = new Map<string, Map<string, number>>()
        prodUnitsData.forEach(pu => {
            if (!conversionMap.has(pu.product_id)) {
                conversionMap.set(pu.product_id, new Map())
            }
            const innerMap = conversionMap.get(pu.product_id)!
            innerMap.set(pu.unit_id, pu.conversion_rate)

            const normName = unitIdMap.get(pu.unit_id)
            if (normName) {
                innerMap.set(normName, pu.conversion_rate)
            }
        })

        let allFetchedLots: any[] = [];
        let from = 0;
        const PAGE_SIZE = 1000;
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from('lots')
                .select(`
                    id,
                    code,
                    warehouse_name,
                    status,
                    production_id,
                    production_lot_id,
                    production_code,
                    batch_code,
                    lot_items (
                        id,
                        product_id,
                        quantity,
                        unit
                    )
                `)
                .neq('status', 'hidden')
                .order('id')
                .range(from, from + PAGE_SIZE - 1);

            if (normalizedSystemType) {
                query = query.eq('system_code', normalizedSystemType);
            }

            if (warehouse && warehouse !== "Tất cả") {
                query = query.eq('warehouse_name', warehouse);
            }

            const { data: lots, error } = await query;
            if (error) throw error;

            if (!lots || lots.length === 0) {
                hasMore = false;
            } else {
                allFetchedLots = [...allFetchedLots, ...lots];
                if (lots.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    from += PAGE_SIZE;
                }
            }
        }

        const matchSearch = (val: string | null | undefined, query: string) => {
            if (!query) return true
            if (!val) return false
            const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
            const nVal = normalize(val)

            const orParts = query.split(';').map(p => p.trim()).filter(Boolean)
            return orParts.some(orPart => {
                const andParts = orPart.split('&').map(p => p.trim()).filter(Boolean)
                return andParts.every(andPart => nVal.includes(normalize(andPart)))
            })
        }

        const orders = new Map<string, OrderEntry>();

        const ensureOrder = (code: string, name: string | null) => {
            if (!orders.has(code)) {
                orders.set(code, { orderCode: code, orderName: name, lots: new Map() });
            }
            return orders.get(code)!;
        }

        allFetchedLots.forEach((lot: any) => {
            if (!lot.lot_items) return;

            const prodLot = lot.production_lot_id ? prodLotMap.get(lot.production_lot_id) : null;
            // Lệnh sản xuất suy ra trực tiếp từ lot, nếu thiếu thì lấy qua production_lots
            const order = lot.production_id
                ? orderMap.get(lot.production_id)
                : (prodLot?.production_id ? orderMap.get(prodLot.production_id) : null);

            const orderCode = order?.code || NO_ORDER;
            const lotCode = prodLot?.lot_code || lot.production_code || NO_LOT;

            const orderEntry = ensureOrder(orderCode, order?.name || null);
            if (!orderEntry.lots.has(lotCode)) {
                orderEntry.lots.set(lotCode, { lotCode, productionDate: prodLot?.production_date || null, products: new Map() });
            }
            const lotEntry = orderEntry.lots.get(lotCode)!;

            lot.lot_items.forEach((item: any) => {
                const pid = item.product_id
                const prod = productMap.get(pid)
                if (!prod) return;

                if (q) {
                    const checkName = (searchMode === 'all' || searchMode === 'name') && matchSearch(prod.name, q)
                    const checkCode = (searchMode === 'all' || searchMode === 'code' || searchMode === 'tag')
                        && (matchSearch(prod.sku, q) || matchSearch(lot.code, q) || matchSearch(orderCode, q) || matchSearch(lotCode, q) || matchSearch(order?.name, q))

                    if (!checkName && !checkCode) return
                }

                const uName = (item.unit || '').trim();

                let quantity = item.quantity
                let unitDisplay = uName
                let isUnconvertible = false
                let key = `${prod.sku}__${canonicalizeUnit(uName)}`

                const baseUnitName = prod.unit || null
                const isTargetKg = targetUnit && isKg(targetUnit.name)
                const hasWeightSuffix = extractWeightFromName(uName) !== null

                const isConvertible = targetUnitId && prod && (
                    normalizeUnit(baseUnitName) === normalizeUnit(targetUnit?.name) ||
                    conversionMap.get(pid)?.has(targetUnitId) ||
                    (isTargetKg && hasWeightSuffix)
                )

                const isBaseKg = isKg(baseUnitName)

                if (targetUnitId && isConvertible) {
                    key = `${prod.sku}__${targetUnitId}`
                    const rate = conversionMap.get(pid)?.get(targetUnitId)
                    const suffix = (rate && rate > 1 && !targetUnit!.name.includes('(') && isBaseKg) ? ` (${rate}kg)` : ''
                    unitDisplay = targetUnit!.name + suffix
                    quantity = convertUnitLogic(pid, uName, targetUnit!.name, quantity, baseUnitName, unitNameMap, conversionMap)
                } else {
                    if (targetUnitId) isUnconvertible = true
                    const normUName = normalizeUnit(uName);
                    const productRates = pid ? conversionMap.get(pid) : null
                    let rate = undefined
                    if (productRates) {
                        const matchingUnit = (unitsData as any[]).find(u => {
                            const n = normalizeUnit(u.name)
                            return (n === normUName || n.replace(/\s*\([^)]*\)/, '').trim() === normUName) && productRates.has(u.id)
                        })
                        if (matchingUnit) rate = productRates.get(matchingUnit.id)
                    }
                    if (rate && rate > 1 && !unitDisplay.includes('(') && isBaseKg) {
                        unitDisplay = uName + ` (${rate}kg)`
                    }
                }

                if (!lotEntry.products.has(key)) {
                    lotEntry.products.set(key, {
                        productCode: prod.sku,
                        productName: prod.name,
                        quantity: 0,
                        unit: unitDisplay,
                        lotCodes: [],
                        isUnconvertible
                    });
                }

                const entry = lotEntry.products.get(key)!;
                entry.quantity += quantity;
                if (!entry.lotCodes.includes(lot.code)) {
                    entry.lotCodes.push(lot.code);
                }
            });
        });

        const items: any[] = [];
        orders.forEach(order => {
            const lotsOut: any[] = [];

            order.lots.forEach(lotEntry => {
                const products = Array.from(lotEntry.products.values())
                    .map(p => ({
                        productCode: p.productCode,
                        productName: p.productName,
                        quantity: p.quantity,
                        unit: p.unit,
                        lotCodes: p.lotCodes,
                        isUnconvertible: p.isUnconvertible
                    }))
                    .sort((a, b) => b.quantity - a.quantity);

                lotsOut.push({
                    lotCode: lotEntry.lotCode,
                    productionDate: lotEntry.productionDate,
                    products
                });
            });

            lotsOut.sort((a, b) => {
                if (a.lotCode === NO_LOT) return 1;
                if (b.lotCode === NO_LOT) return -1;
                return a.lotCode.localeCompare(b.lotCode);
            });

            items.push({
                orderCode: order.orderCode,
                orderName: order.orderName,
                lots: lotsOut
            });
        });

        items.sort((a, b) => {
            if (a.orderCode === NO_ORDER) return 1;
            if (b.orderCode === NO_ORDER) return -1;
            return a.orderCode.localeCompare(b.orderCode);
        });

        return NextResponse.json({ ok: true, items });

    } catch (err: any) {
        console.error("GET /api/inventory/by-production error:", err);
        return NextResponse.json(
            { ok: false, error: err?.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
