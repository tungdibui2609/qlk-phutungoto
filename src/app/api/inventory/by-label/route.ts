import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from "@/lib/database.types";
import { convertUnit as convertUnitLogic, normalizeUnit, canonicalizeUnit, isKg, extractWeightFromName } from '@/lib/unitConversion'

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
        const warehouse = searchParams.get("warehouse") || "";
        const systemParam = searchParams.get('systemType')
        const systemType = systemParam || cookieStore.get('systemType')?.value || 'FROZEN'
        const targetUnitId = searchParams.get('targetUnitId')
        const q = searchParams.get('q')
        const searchMode = searchParams.get('searchMode') || 'all'
        const categoryIds = searchParams.get('categoryIds') || '';

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

        // 1. Fetch all box_labels for the current system_code
        let allFetchedLabels: any[] = [];
        let from = 0;
        const PAGE_SIZE = 1000;
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from('box_labels')
                .select(`
                    id,
                    code,
                    product_id,
                    quantity,
                    unit,
                    semi_finished_lot_code,
                    finished_lot_code,
                    lot_id,
                    status,
                    created_at,
                    products (
                        id,
                        sku,
                        name,
                        unit,
                        product_category_rel(category_id)
                    ),
                    lots (
                        id,
                        code,
                        status,
                        warehouse_name
                    )
                `)
                .eq('system_code', normalizedSystemType)
                .range(from, from + PAGE_SIZE - 1);

            const { data: labels, error } = await query;
            if (error) throw error;

            if (!labels || labels.length === 0) {
                hasMore = false;
            } else {
                allFetchedLabels = [...allFetchedLabels, ...labels];
                if (labels.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    from += PAGE_SIZE;
                }
            }
        }

        if (allFetchedLabels.length === 0) {
            return NextResponse.json({ ok: true, items: [] });
        }

        // 2. Filter labels that are physically in inventory
        // (lot_id is null OR lots.status is not exported and not hidden)
        const activeLabels = allFetchedLabels.filter((label: any) => {
            if (label.lot_id && label.lots) {
                const status = label.lots.status;
                if (status === 'exported' || status === 'hidden') {
                    return false;
                }
            }
            return true;
        });

        // 3. Apply Warehouse Filter
        let filtered = activeLabels;
        if (warehouse && warehouse !== 'Tất cả') {
            filtered = filtered.filter((label: any) => label.lots?.warehouse_name === warehouse);
        }

        // 4. Apply Date Filter (based on label creation date)
        if (searchParams.get('dateFrom') || searchParams.get('dateTo')) {
            const dateFrom = searchParams.get('dateFrom');
            const dateTo = searchParams.get('dateTo');
            filtered = filtered.filter((label: any) => {
                const createdAt = new Date(label.created_at);
                if (dateFrom) {
                    const start = new Date(`${dateFrom}T00:00:00`);
                    if (createdAt < start) return false;
                }
                if (dateTo) {
                    const end = new Date(`${dateTo}T23:59:59.999`);
                    if (createdAt > end) return false;
                }
                return true;
            });
        }

        // 5. Apply Product Category Filter
        if (categoryIds) {
            const catIds = categoryIds.split(',').filter(Boolean);
            if (catIds.length > 0) {
                filtered = filtered.filter((label: any) => {
                    const rels = label.products?.product_category_rel;
                    if (!rels) return false;
                    const relArray = Array.isArray(rels) ? rels : [rels];
                    return relArray.some((r: any) => catIds.includes(r.category_id));
                });
            }
        }

        // 6. Apply Search Query Filter (Accent-insensitive, AND/OR logic)
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
            filtered = filtered.filter((label: any) => {
                const prodName = label.products?.name || '';
                const prodSku = label.products?.sku || '';
                const finishedLot = label.finished_lot_code || '';
                const semiFinishedLot = label.semi_finished_lot_code || '';
                const code = label.code || '';

                const checkProd = (searchMode === 'all' || searchMode === 'name') && matchSearch(prodName, q)
                const checkCode = (searchMode === 'all' || searchMode === 'code') && (matchSearch(prodSku, q) || matchSearch(code, q))
                const checkLot = (searchMode === 'all' || searchMode === 'production') && (matchSearch(finishedLot, q) || matchSearch(semiFinishedLot, q))
                const checkStt = (searchMode === 'all' || searchMode === 'stt') && matchSearch(code, q)

                return checkProd || checkCode || checkLot || checkStt;
            });
        }

        // 7. Unit conversion maps
        const productMap = new Map<string, any>()
        productsData.forEach(p => productMap.set(p.id, p))

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

        // 8. Group by product, semi_finished_lot_code, finished_lot_code, and unit
        const labelInventory = new Map<string, {
            product_id: string;
            productCode: string;
            productName: string;
            semi_finished_lot_code: string;
            finished_lot_code: string;
            labelCount: number;
            totalQuantity: number;
            unit: string;
            isUnconvertible?: boolean;
        }>();

        filtered.forEach((label: any) => {
            const pid = label.product_id;
            const prod = label.products;
            if (!prod) return;

            const semiLotCode = label.semi_finished_lot_code || '---';
            const finishedLotCode = label.finished_lot_code || '---';
            const uName = (label.unit || '').trim();

            let quantity = parseFloat(label.quantity) || 0;
            let unitDisplay = uName;
            let isUnconvertible = false;

            const baseUnitName = prod.unit || null
            const isTargetKg = targetUnit && isKg(targetUnit.name)
            const hasWeightSuffix = extractWeightFromName(uName) !== null

            const isConvertible = targetUnitId && prod && (
                normalizeUnit(baseUnitName) === normalizeUnit(targetUnit?.name) ||
                conversionMap.get(pid)?.has(targetUnitId) ||
                (isTargetKg && hasWeightSuffix)
            )

            let targetKeyUnit = canonicalizeUnit(uName);
            if (targetUnitId && isConvertible) {
                targetKeyUnit = targetUnitId;
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

            const groupKey = `${pid}__${semiLotCode}__${finishedLotCode}__${targetKeyUnit}`;

            if (!labelInventory.has(groupKey)) {
                labelInventory.set(groupKey, {
                    product_id: pid,
                    productCode: prod.sku,
                    productName: prod.name,
                    semi_finished_lot_code: semiLotCode,
                    finished_lot_code: finishedLotCode,
                    labelCount: 0,
                    totalQuantity: 0,
                    unit: unitDisplay,
                    isUnconvertible
                });
            }

            const entry = labelInventory.get(groupKey)!;
            entry.labelCount += 1;
            entry.totalQuantity += quantity;
        });

        const items = Array.from(labelInventory.values());

        // Sort items by Product Name first, then Finished Lot Code
        items.sort((a, b) => {
            const compName = a.productName.localeCompare(b.productName);
            if (compName !== 0) return compName;
            return a.finished_lot_code.localeCompare(b.finished_lot_code);
        });

        return NextResponse.json({
            ok: true,
            items
        });

    } catch (err: any) {
        console.error("GET /api/inventory/by-label error:", err);
        return NextResponse.json(
            { ok: false, error: err?.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
