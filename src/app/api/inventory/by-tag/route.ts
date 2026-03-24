import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from "@/lib/database.types";
import { convertUnit as convertUnitLogic, normalizeUnit, isKg, extractWeightFromName } from '@/lib/unitConversion'

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const authHeader = req.headers.get('Authorization')

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

        const searchParams = req.nextUrl.searchParams;
        const tagFilter = (searchParams.get("tag") || "").toLowerCase(); 
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

        const units = unitsData as any[]
        const targetUnit = targetUnitId ? units?.find(u => u.id === targetUnitId) : null


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
                    lot_items (
                        id,
                        product_id,
                        quantity,
                        unit
                    ),
                    lot_tags (
                        tag,
                        lot_item_id
                    )
                `)
                .neq('status', 'hidden')
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

        if (allFetchedLots.length === 0) return NextResponse.json({ ok: true, items: [], uniqueTags: [] });
        const lots = allFetchedLots;

        const productMap = new Map<string, any>()
        productsData.forEach(p => productMap.set(p.id, p))

        const unitNameMap = new Map<string, string>()
        const unitIdMap = new Map<string, string>()
        units.forEach(u => {
            const normalized = normalizeUnit(u.name)
            unitNameMap.set(normalized, u.id)
            unitIdMap.set(u.id, u.name)
            
            // Also map the name without weight suffix if present (e.g. "Thùng" for "Thùng (20kg)")
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

        const tagInventory = new Map<string, Map<string, {
            productCode: string;
            productName: string;
            quantity: number;
            unit: string;
            lotCodes: string[];
            isUnconvertible?: boolean;
        }>>();

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

        const allTags = new Set<string>();

        lots.forEach((lot: any) => {
            if (!lot.lot_items) return;

            const generalTags = (lot.lot_tags || [])
                .filter((t: any) => !t.lot_item_id)
                .map((t: any) => t.tag);

            const itemTagsMap = new Map<string, string[]>();
            (lot.lot_tags || []).filter((t: any) => t.lot_item_id).forEach((t: any) => {
                if (!itemTagsMap.has(t.lot_item_id)) itemTagsMap.set(t.lot_item_id, []);
                itemTagsMap.get(t.lot_item_id)!.push(t.tag);
            });

            lot.lot_items.forEach((item: any) => {
                const pid = item.product_id
                const prod = productMap.get(pid)
                if (!prod) return;

                const specificTags = itemTagsMap.get(item.id) || [];
                let combinedTags = Array.from(new Set([...generalTags, ...specificTags]));
                if (combinedTags.length === 0) combinedTags = ["Chưa gắn mã"];

                combinedTags.forEach(currentTag => {
                    if (q) {
                        const checkTag = (searchMode === 'all' || searchMode === 'tag') && matchSearch(currentTag, q)
                        const checkProd = (searchMode === 'all' || searchMode === 'name') && matchSearch(prod.name, q)
                        const checkCode = (searchMode === 'all' || searchMode === 'code') && (matchSearch(prod.sku, q) || matchSearch(lot.code, q))

                        if (!checkTag && !checkProd && !checkCode) return
                    }

                    if (currentTag !== "Chưa gắn mã") allTags.add(currentTag);

                    if (!tagInventory.has(currentTag)) {
                        tagInventory.set(currentTag, new Map());
                    }

                    const productMapForTag = tagInventory.get(currentTag)!;
                    const uName = (item.unit || '').trim();

                    let quantity = item.quantity
                    let unitDisplay = uName
                    let isUnconvertible = false
                    let key = `${prod.sku}__${uName}`

                    const baseUnitName = prod.unit || null
                    const isTargetKg = targetUnit && isKg(targetUnit.name)
                    const hasWeightSuffix = extractWeightFromName(uName) !== null

                    const isConvertible = targetUnitId && prod && (
                        normalizeUnit(baseUnitName) === normalizeUnit(targetUnit?.name) ||
                        conversionMap.get(pid)?.has(targetUnitId) ||
                        (isTargetKg && hasWeightSuffix)
                    )

                    if (targetUnitId && isConvertible) {
                        key = `${prod.sku}__${targetUnitId}`
                        const rate = conversionMap.get(pid)?.get(targetUnitId)
                        const suffix = (rate && rate > 1 && !targetUnit!.name.includes('(')) ? ` (${rate}kg)` : ''
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
                        if (rate && rate > 1 && !unitDisplay.includes('(')) {
                            unitDisplay = uName + ` (${rate}kg)`
                        }
                    }

                    if (!productMapForTag.has(key)) {
                        productMapForTag.set(key, {
                            productCode: prod.sku,
                            productName: prod.name,
                            quantity: 0,
                            unit: unitDisplay,
                            lotCodes: [],
                            isUnconvertible
                        });
                    }

                    const entry = productMapForTag.get(key)!;
                    entry.quantity += quantity;
                    if (!entry.lotCodes.includes(lot.code)) {
                        entry.lotCodes.push(lot.code);
                    }
                });
            });
        });

        const items: any[] = [];
        tagInventory.forEach((productMapForTag, tag) => {
            const products: any[] = [];
            let totalQuantity = 0;
            let primaryUnit = "";

            productMapForTag.forEach(product => {
                products.push({
                    productCode: product.productCode,
                    productName: product.productName,
                    quantity: product.quantity,
                    unit: product.unit,
                    lotCount: product.lotCodes.length,
                    isUnconvertible: product.isUnconvertible
                });
                if (!product.isUnconvertible) {
                    totalQuantity += product.quantity;
                }
                if (!primaryUnit) primaryUnit = product.unit;
            });

            items.push({
                tag,
                totalQuantity,
                unit: primaryUnit,
                products: products.sort((a, b) => b.quantity - a.quantity)
            });
        });

        items.sort((a, b) => {
            if (a.tag === "Chưa gắn mã") return 1;
            if (b.tag === "Chưa gắn mã") return -1;
            return a.tag.localeCompare(b.tag);
        });

        return NextResponse.json({
            ok: true,
            items,
            uniqueTags: Array.from(allTags).sort()
        });

    } catch (err: any) {
        console.error("GET /api/inventory/by-tag error:", err);
        return NextResponse.json(
            { ok: false, error: err?.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
