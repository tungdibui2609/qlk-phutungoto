
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = 'force-dynamic';

/**
 * GET /api/inventory/by-tag
 * Query params:
 *   - tag: Filter by specific tag
 *   - warehouse: Filter by warehouse (branch name)
 *   - systemType: Filter by system code
 * 
 * Returns inventory grouped by tag
 */
export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const tagFilter = searchParams.get("tag") || "";
        const warehouse = searchParams.get("warehouse") || "";
        const systemType = searchParams.get("systemType") || "";

        // Build query
        let query = supabase
            .from('lots')
            .select(`
                id,
                code,
                warehouse_name,
                lot_items (
                    id,
                    quantity,
                    unit,
                    products (
                        id,
                        code:sku,
                        name,
                        unit
                    )
                ),
                lot_tags (
                    tag,
                    lot_item_id
                )
            `)
            .eq('status', 'active'); // Assuming there's a status, or just all lots

        if (systemType) {
            query = query.eq('system_code', systemType);
        }

        // We can't easily filter by warehouse name if it's stored loosely, 
        // but if 'warehouse_name' is the column:
        if (warehouse && warehouse !== "Tất cả") {
            query = query.eq('warehouse_name', warehouse);
        }

        const { data: lots, error } = await query;

        if (error) throw error;
        if (!lots) return NextResponse.json({ ok: true, items: [], uniqueTags: [] });

        // Build inventory grouped by tag
        // Structure: { tag -> { productCode__unit -> { productCode, productName, quantity, unit, lotCodes } } }
        const tagInventory = new Map<string, Map<string, {
            productCode: string;
            productName: string;
            productType: string;
            quantity: number;
            unit: string;
            lotCodes: string[];
        }>>();

        const allTags = new Set<string>();

        // Process lots
        lots.forEach((lot: any) => {
            if (!lot.lot_items) return;

            // Group tags by lot_item_id
            // Tags with lot_item_id = null are considered "General Tags" for the Lot
            // But we only want to count items.
            // Current strict logic: Tags must be assigned to items to be counted in "Inventory by Tag" for that item?
            // OR: General tags apply to ALL items in the lot?
            // Let's assume General Tags apply to all items for now, to be safe/generous.

            const generalTags = (lot.lot_tags || [])
                .filter((t: any) => !t.lot_item_id)
                .map((t: any) => t.tag);

            const itemTagsMap = new Map<string, string[]>();
            (lot.lot_tags || []).filter((t: any) => t.lot_item_id).forEach((t: any) => {
                if (!itemTagsMap.has(t.lot_item_id)) itemTagsMap.set(t.lot_item_id, []);
                itemTagsMap.get(t.lot_item_id)!.push(t.tag);
            });

            lot.lot_items.forEach((item: any) => {
                const product = item.products;
                if (!product) return;

                // Combine general tags + specific item tags
                const specificTags = itemTagsMap.get(item.id) || [];
                const combinedTags = Array.from(new Set([...generalTags, ...specificTags]));

                if (combinedTags.length === 0) return;

                // If filtering by tag
                if (tagFilter && !combinedTags.includes(tagFilter)) return;

                combinedTags.forEach(t => allTags.add(t));

                // Composite tag key
                const compositeTag = combinedTags.sort().join('; ');

                if (!tagInventory.has(compositeTag)) {
                    tagInventory.set(compositeTag, new Map());
                }

                const productMap = tagInventory.get(compositeTag)!;
                const unit = (item.unit || product.unit || '').trim();
                const key = `${product.code}__${unit}`;

                if (!productMap.has(key)) {
                    productMap.set(key, {
                        productCode: product.code,
                        productName: product.name,
                        productType: '', // Not strictly used right now
                        quantity: 0,
                        unit: unit,
                        lotCodes: []
                    });
                }

                const entry = productMap.get(key)!;
                entry.quantity += item.quantity;
                if (!entry.lotCodes.includes(lot.code)) {
                    entry.lotCodes.push(lot.code);
                }
            });
        });

        // Format Response
        const items: any[] = [];
        tagInventory.forEach((productMap, tag) => {
            const products: any[] = [];
            let totalQuantity = 0;
            let primaryUnit = "";

            productMap.forEach(product => {
                products.push({
                    productCode: product.productCode,
                    productName: product.productName,
                    quantity: product.quantity,
                    unit: product.unit,
                    lotCount: product.lotCodes.length
                });
                totalQuantity += product.quantity;
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
