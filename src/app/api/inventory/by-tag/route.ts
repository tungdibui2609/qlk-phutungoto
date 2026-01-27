
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from "@/lib/database.types";
import { convertUnit as convertUnitLogic } from '@/lib/unitConversion'

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
        const tagFilter = searchParams.get("tag") || "";
        const warehouse = searchParams.get("warehouse") || "";
        const systemParam = searchParams.get('systemType')
        const systemType = systemParam || cookieStore.get('systemType')?.value || 'FROZEN'
        const targetUnitId = searchParams.get('targetUnitId')

        // Fetch Support Data
        const { data: unitsData } = await supabase.from('units').select('id, name')
        const { data: productsData } = await supabase.from('products').select('id, sku, name, unit')
        const { data: prodUnitsData } = await supabase.from('product_units').select('product_id, unit_id, conversion_rate')

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

        // Build query
        let query = supabase
            .from('lots')
            .select(`
                id,
                code,
                warehouse_name,
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
            .eq('status', 'active');

        if (systemType) {
            query = query.eq('system_code', systemType);
        }

        if (warehouse && warehouse !== "Tất cả") {
            query = query.eq('warehouse_name', warehouse);
        }

        const { data: lots, error } = await query;

        if (error) throw error;
        if (!lots) return NextResponse.json({ ok: true, items: [], uniqueTags: [] });

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
                const combinedTags = Array.from(new Set([...generalTags, ...specificTags]));
                if (combinedTags.length === 0) return;

                if (tagFilter && !combinedTags.includes(tagFilter)) return;
                combinedTags.forEach(t => allTags.add(t));

                const compositeTag = combinedTags.sort().join('; ');
                if (!tagInventory.has(compositeTag)) {
                    tagInventory.set(compositeTag, new Map());
                }

                const productMapForTag = tagInventory.get(compositeTag)!;
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

        items.sort((a, b) => a.tag.localeCompare(b.tag));
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
