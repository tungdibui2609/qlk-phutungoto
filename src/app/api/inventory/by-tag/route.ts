
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from "@/lib/database.types";
import { convertUnit as convertUnitLogic } from '@/lib/unitConversion'
// Removed fs/path imports

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
        const tagFilter = (searchParams.get("tag") || "").toLowerCase(); // Case-insensitive filter
        const warehouse = searchParams.get("warehouse") || "";
        const systemParam = searchParams.get('systemType')
        const systemType = systemParam || cookieStore.get('systemType')?.value || 'FROZEN'
        const targetUnitId = searchParams.get('targetUnitId')

        // Normalize systemType: Handle common mismatches
        let normalizedSystemType = systemType;
        if (systemType === 'FROZEN') normalizedSystemType = 'KHO_DONG_LANH';
        if (systemType === 'DRY') normalizedSystemType = 'KHO_VAT_TU_BAO_BI'; // Or whatever DRY maps to

        // Fetch Support Data with pagination to bypass 1000 limit
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

        const targetUnit = targetUnitId ? (unitsData as any[])?.find(u => u.id === targetUnitId) : null
        const unitNameMap = new Map<string, string>()
            ; (unitsData as any[])?.forEach(u => unitNameMap.set(u.name.toLowerCase(), u.id))

        const productMap = new Map<string, any>()
            ; (productsData as any[])?.forEach(p => productMap.set(p.id, p))

        const conversionMap = new Map<string, Map<string, number>>()
            ; (prodUnitsData as any[])?.forEach(pu => {
                if (!conversionMap.has(pu.product_id)) {
                    conversionMap.set(pu.product_id, new Map())
                }
                conversionMap.get(pu.product_id)!.set(pu.unit_id, pu.conversion_rate)
            })

        // Build query and Fetch ALL lots using pagination
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
        const lots = allFetchedLots; // Re-use the 'lots' variable name for the rest of processing

        const tagInventory = new Map<string, Map<string, {
            productCode: string;
            productName: string;
            quantity: number;
            unit: string;
            lotCodes: string[];
            isUnconvertible?: boolean;
        }>>();

        const allTags = new Set<string>();

        lots.forEach((lot: any) => {
            if (!lot.lot_items) return;

            // 1. Get General Tags for the LOT
            const generalTags = (lot.lot_tags || [])
                .filter((t: any) => !t.lot_item_id)
                .map((t: any) => t.tag);

            // 2. Map Specific Tags per item
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
                // FLATTEN: Instead of one composite string, we treat each tag separately
                // Also handle "No Tag" case
                let combinedTags = Array.from(new Set([...generalTags, ...specificTags]));
                if (combinedTags.length === 0) combinedTags = ["Chưa gắn mã"];

                combinedTags.forEach(currentTag => {
                    // CASE-INSENSITIVE Filter
                    if (tagFilter && currentTag.toLowerCase() !== tagFilter.toLowerCase()) return;
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
                    const isConvertible = targetUnitId && prod && (
                        baseUnitName?.toLowerCase() === targetUnit?.name?.toLowerCase() ||
                        conversionMap.get(pid)?.has(targetUnitId)
                    )

                    if (targetUnitId && isConvertible) {
                        key = `${prod.sku}__${targetUnitId}`
                        unitDisplay = targetUnit.name
                        quantity = convertUnitLogic(pid, uName, targetUnit.name, quantity, baseUnitName, unitNameMap, conversionMap)
                    } else {
                        if (targetUnitId) isUnconvertible = true
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

        // Sort: "Chưa gắn mã" at the end, others by name
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
