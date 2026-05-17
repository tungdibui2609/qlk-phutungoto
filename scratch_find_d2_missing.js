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

async function main() {
    console.log('--- KHẢO SÁT 19 POSITIONS CỦA DÃY 2 ---');

    try {
        const prodLotId = '85fb6918-8aae-4319-ab54-cf5fab0912d7'; // L034DD260-TN

        // 1. Lấy 19 positions Dãy 2 trong DB được gán cho active lot
        const { data: lots } = await supabase
            .from('lots')
            .select('id, code')
            .eq('production_lot_id', prodLotId)
            .eq('status', 'active');

        const activeLotIds = lots.map(l => l.id);

        const { data: positions } = await supabase
            .from('positions')
            .select('id, code, lot_id, system_type')
            .in('lot_id', activeLotIds)
            .like('code', 'K3D2%'); // Lọc các vị trí bắt đầu bằng K3D2 (Dãy 2)

        console.log(`Tìm thấy ${positions.length} positions Dãy 2 đã gán lot active trong DB:`);
        
        // 2. Lấy thông tin zone_positions cho các positions này
        const posIds = positions.map(p => p.id);
        const { data: zonePositions } = await supabase
            .from('zone_positions')
            .select('position_id, zone_id, zones(name, code, is_hall, level, parent_id)')
            .in('position_id', posIds);

        positions.forEach((pos, idx) => {
            const zp = zonePositions.find(z => z.position_id === pos.id);
            console.log(`Pos #${idx + 1}: ${pos.code} | ID: ${pos.id}`);
            if (zp) {
                console.log(`  Zone: ${zp.zones?.name} | Code: ${zp.zones?.code} | Parent ID: ${zp.zones?.parent_id}`);
            } else {
                console.log(`  [CẢNH BÁO] Không có Zone liên kết trong zone_positions!`);
            }
        });

    } catch (e) {
        console.error(e);
    }
}

main();
