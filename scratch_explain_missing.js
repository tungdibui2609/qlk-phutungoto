const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

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

async function fetchAllZonesPos(limit = 1000) {
    let allRecs = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('zone_positions')
            .select('zone_id, position_id, positions!inner(system_type)')
            .eq('positions.system_type', 'KHO_DONG_LANH')
            .order('zone_id', { ascending: true })
            .order('position_id', { ascending: true })
            .range(from, from + limit - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allRecs = [...allRecs, ...data];
        if (data.length < limit) break;
        from += limit;
    }
    return allRecs;
}

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

async function main() {
    console.log('--- KHẢO SÁT CHI TIẾT TÌM KIẾM SƠ ĐỒ KHO ---');

    try {
        const systemType = 'KHO_DONG_LANH';
        const prodLotId = '85fb6918-8aae-4319-ab54-cf5fab0912d7'; // L034DD260-TN
        const searchTerm = 'LSX030426 & L034DD260-TN';

        // 1. Fetch data y hệt useWarehouseData
        const [posData, zoneData, zpData, lotsData] = await Promise.all([
            fetchAll('positions', q => q.eq('system_type', systemType).order('code').order('id')),
            fetchAll('zones', q => q.eq('system_type', systemType).order('level').order('code').order('id')),
            fetchAllZonesPos(),
            fetchAll('lots', q => q.eq('system_code', systemType), '*, productions(code, name, production_lots(id, lot_code, product_id)), suppliers(name), qc_info(name), products(name, unit, sku, internal_code, internal_name, product_category_rel(categories(name))), lot_items(id, product_id, quantity, unit, products(name, unit, sku, internal_code, internal_name, product_category_rel(categories(name)))), lot_tags(tag, lot_item_id)')
        ]);

        const zpLookup = {};
        zpData.forEach(zp => {
            if (zp.position_id && zp.zone_id) zpLookup[zp.position_id] = zp.zone_id;
        });

        const posWithZone = posData.map(pos => ({
            ...pos,
            zone_id: zpLookup[pos.id] || null
        }));

        const lotInfoMap = {};
        lotsData.forEach(l => {
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

        // 2. Chạy logic lọc của useMapFilters
        let result = posWithZone;

        // Giả lập filter by search term
        result = result.filter(p => {
            const lot = p.lot_id ? lotInfoMap[p.lot_id] : null;
            if (!lot) return false;

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

            return advancedMatchSearch(res, searchTerm);
        });

        console.log(`\nSau khi áp dụng bộ lọc của useMapFilters, số positions tìm thấy: ${result.length}`);

        // 3. Tìm các positions đã gán lot active trong DB nhưng KHÔNG CÓ trong `result`
        const { data: dbLots } = await supabase
            .from('lots')
            .select('id, code')
            .eq('production_lot_id', prodLotId)
            .eq('status', 'active');

        const activeLotIds = dbLots.map(l => l.id);

        const { data: dbPositions } = await supabase
            .from('positions')
            .select('id, code, lot_id')
            .in('lot_id', activeLotIds);

        console.log(`DB có ${dbPositions.length} positions đã gán lot active.`);

        const matchedIds = new Set(result.map(p => p.id));
        const missing = dbPositions.filter(p => !matchedIds.has(p.id));

        console.log(`\nSố vị trí bị thiếu sau bộ lọc: ${missing.length}`);
        missing.forEach(p => {
            const lot = dbLots.find(l => l.id === p.lot_id);
            console.log(`- Vị trí: ${p.code} (ID: ${p.id}) | Lot: ${lot ? lot.code : 'N/A'}`);
            
            // Check xem position này có trong posWithZone ban đầu không
            const inPosData = posWithZone.find(x => x.id === p.id);
            console.log(`  + Có trong posData (từ bảng positions có system_type = KHO_DONG_LANH)? ${!!inPosData}`);
            if (inPosData) {
                console.log(`  + zone_id: ${inPosData.zone_id}`);
                const lotInInfo = lotInfoMap[p.lot_id];
                console.log(`  + Có trong lotInfoMap? ${!!lotInInfo}`);
                if (lotInInfo) {
                    console.log(`  + Trạng thái lot: ${lotInInfo.status}`);
                    console.log(`  + Số lượng items: ${lotInInfo.items ? lotInInfo.items.length : 0}`);
                    console.log(`  + Chi tiết items:`, JSON.stringify(lotInInfo.items));
                }
            }
        });

    } catch (e) {
        console.error(e);
    }
}

main();
