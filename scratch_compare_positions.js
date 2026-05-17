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

async function fetchAllZonesPos(systemType, limit = 1000) {
    let allRecs = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('zone_positions')
            .select('zone_id, position_id, positions!inner(system_type)')
            .eq('positions.system_type', systemType)
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

async function main() {
    console.log('--- SO SÁNH POSITIONS TRÊN UI VÀ TRONG DB ---');

    try {
        const systemType = 'KHO_DONG_LANH';
        const prodLotId = '85fb6918-8aae-4319-ab54-cf5fab0912d7'; // L034DD260-TN

        // 1. Fetch dữ liệu y hệt UI
        const [posData, zpData] = await Promise.all([
            fetchAll('positions', q => q.eq('system_type', systemType).order('code').order('id')),
            fetchAllZonesPos(systemType)
        ]);

        const zpLookup = {};
        zpData.forEach(zp => {
            if (zp.position_id && zp.zone_id) zpLookup[zp.position_id] = zp.zone_id;
        });

        const posWithZone = posData.map(pos => ({
            ...pos,
            zone_id: zpLookup[pos.id] || null
        }));

        console.log(`UI load được ${posWithZone.length} positions.`);
        
        // 2. Query 39 positions trong DB được gán cho lot active của L034DD260-TN
        const { data: lots } = await supabase
            .from('lots')
            .select('id, code')
            .eq('production_lot_id', prodLotId)
            .eq('status', 'active');

        const activeLotIds = lots.map(l => l.id);

        const { data: dbPositions } = await supabase
            .from('positions')
            .select('id, code, lot_id')
            .in('lot_id', activeLotIds);

        console.log(`DB tìm thấy ${dbPositions.length} positions đã gán.`);

        // 3. Tìm 3 positions bị thiếu trên UI
        const uiPosIds = new Set(posWithZone.map(p => p.id));
        const missingPositions = dbPositions.filter(p => !uiPosIds.has(p.id));

        console.log(`\nCó ${missingPositions.length} positions BỊ THIẾU trên sơ đồ kho:`);
        missingPositions.forEach(p => {
            const lot = lots.find(l => l.id === p.lot_id);
            console.log(`- Mã vị trí: ${p.code} (ID: ${p.id}) | Lô hàng: ${lot ? lot.code : 'N/A'}`);
        });

        // 4. Kiểm tra xem 3 positions bị thiếu này có system_type là gì trong DB
        if (missingPositions.length > 0) {
            const { data: missingDetails } = await supabase
                .from('positions')
                .select('id, code, system_type')
                .in('id', missingPositions.map(p => p.id));
            
            console.log('\nChi tiết system_type của các vị trí bị thiếu trong DB:');
            console.log(JSON.stringify(missingDetails, null, 2));
        }

    } catch (e) {
        console.error(e);
    }
}

main();
