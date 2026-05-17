const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function advancedMatchSearch(vals, query) {
    if (!query) return true;
    const parts = query.split('&').map(p => p.trim().toLowerCase()).filter(Boolean);
    if (parts.length === 0) return true;

    return parts.every(part => {
        const orParts = part.split(/[; ]+/).map(p => p.trim()).filter(Boolean);
        if (orParts.length === 0) return true;

        return orParts.some(op => {
            return vals.some(val => String(val).toLowerCase().includes(op));
        });
    });
}

async function fetchAll(table, filter, customSelect = '*', limit = 1000) {
    let allRecs = [];
    let from = 0;
    while (true) {
        let query = supabase.from(table).select(customSelect).range(from, from + limit - 1);
        if (filter) query = filter(query);
        const { data, error } = await query;

        if (error) throw error;
        if (!data || data.length === 0) break;

        allRecs = [...allRecs, ...data];
        if (data.length < limit) break;
        from += limit;
    }
    return allRecs;
}

async function main() {
    console.log('--- KIỂM TRA KHỚP LỌC TÌM KIẾM TRÊN TOÀN BỘ 39 POSITIONS ---');

    try {
        const prodLotId = '85fb6918-8aae-4319-ab54-cf5fab0912d7'; // L034DD260-TN
        const searchTerm = 'LSX030426 & L034DD260-TN';

        // 1. Fetch all lots belonging to this production lot
        const { data: lots, error: err1 } = await supabase
            .from('lots')
            .select('*, productions(code, name, production_lots(id, lot_code, product_id)), suppliers(name), qc_info(name), products(name, unit, sku, internal_code, internal_name, product_category_rel(categories(name))), lot_items(id, product_id, quantity, unit, products(name, unit, sku, internal_code, internal_name, product_category_rel(categories(name)))), lot_tags(tag, lot_item_id)')
            .eq('production_lot_id', prodLotId);

        if (err1) {
            console.error('Lỗi fetch lots:', err1);
            return;
        }

        const activeLots = lots.filter(l => l.status === 'active');
        const activeLotIds = activeLots.map(l => l.id);

        // 2. Fetch positions linked to active lots
        const { data: dbPositions } = await supabase
            .from('positions')
            .select('*')
            .in('lot_id', activeLotIds);

        console.log(`DB tìm thấy ${dbPositions.length} positions đã gán lot active.`);

        // Map lot info exactly like useWarehouseData
        const lotInfoMap = {};
        lots.forEach(l => {
            const lotItems = l.lot_items || [];
            const allTags = l.lot_tags || [];
            let items = [];
            let accumulatedTags = [];

            if (lotItems.length > 0) {
                items = lotItems.map(item => {
                    const itemTags = allTags
                        .filter(t => t.lot_item_id === item.id)
                        .map(t => t.tag.replace(/@/g, item.products?.sku || ''))
                        .filter(t => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'));
                    accumulatedTags.push(...itemTags);
                    return {
                        product_name: item.products?.name || '',
                        sku: item.products?.sku || '',
                        internal_code: item.products?.internal_code || '',
                        internal_name: item.products?.internal_name || '',
                        unit: item.unit || item.products?.unit || '',
                        quantity: item.quantity || 0,
                        tags: itemTags
                    };
                });
            } else if (l.products) {
                const itemTags = allTags
                    .map(t => t.tag.replace(/@/g, l.products?.sku || ''))
                    .filter(t => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'));
                accumulatedTags.push(...itemTags);
                items = [{
                    product_name: l.products.name || '',
                    sku: l.products.sku || '',
                    internal_code: l.products.internal_code || '',
                    internal_name: l.products.internal_name || '',
                    unit: l.products.unit || '',
                    quantity: l.quantity || 0,
                    tags: itemTags
                }];
            }

            const prodData = Array.isArray(l.productions) ? l.productions[0] : l.productions;
            const lotProdLotId = l.production_lot_id;
            const allProdLots = (prodData?.production_lots || [])
                .filter(pl => pl.id === lotProdLotId)
                .map(pl => pl.lot_code)
                .filter(Boolean);

            lotInfoMap[l.id] = {
                ...l,
                items,
                tags: accumulatedTags,
                qc_name: l.qc_info?.name,
                supplier_name: l.suppliers?.name,
                productions: prodData,
                production_lot_codes: allProdLots
            };
        });

        // 3. Thực hiện search
        let matchCount = 0;
        let failCount = 0;

        dbPositions.forEach(p => {
            const lot = p.lot_id ? lotInfoMap[p.lot_id] : null;
            if (!lot) {
                console.log(`- Vị trí ${p.code} không tìm thấy LotInfo!`);
                failCount++;
                return;
            }

            const res = [p.code];
            if (lot.code) res.push(lot.code);
            lot.items?.forEach(it => {
                if (it.product_name) res.push(it.product_name);
                if (it.internal_name) res.push(it.internal_name);
                if (it.sku) res.push(it.sku);
                if (it.internal_code) res.push(it.internal_code);
            });
            lot.tags?.forEach(t => res.push(t));
            if (lot.production_code) res.push(lot.production_code);
            if (lot.productions?.code) res.push(lot.productions.code);
            if (lot.productions?.name) res.push(lot.productions.name);
            lot.production_lot_codes?.forEach(code => res.push(code));
            if (lot.daily_seq) res.push(String(lot.daily_seq));
            if (lot.supplier_name) res.push(lot.supplier_name);
            if (lot.qc_name) res.push(lot.qc_name);

            const isMatch = advancedMatchSearch(res, searchTerm);
            if (isMatch) {
                matchCount++;
            } else {
                failCount++;
                console.log(`\n[THẤT BẠI] Vị trí ${p.code} (Lot: ${lot.code}) KHÔNG KHỚP TÌM KIẾM!`);
                console.log(`  - Searchable Vals:`, JSON.stringify(res));
                console.log(`  - Production Code in lot:`, lot.production_code);
                console.log(`  - Production Lot Codes:`, lot.production_lot_codes);
                console.log(`  - Productions:`, lot.productions ? { code: lot.productions.code, name: lot.productions.name } : 'Null');
            }
        });

        console.log(`\n=== KẾT QUẢ GIẢ LẬP SEARCH ===`);
        console.log(`- Khớp thành công: ${matchCount} vị trí`);
        console.log(`- Không khớp: ${failCount} vị trí`);

    } catch (e) {
        console.error(e);
    }
}

main();
