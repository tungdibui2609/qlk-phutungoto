const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- KIỂM TRA PHÂN HỆ VÀ ZONE CỦA 39 POSITIONS ---');

    try {
        const prodLotId = '85fb6918-8aae-4319-ab54-cf5fab0912d7'; // L034DD260-TN

        // 1. Lấy tất cả active lots
        const { data: lots, error: err1 } = await supabase
            .from('lots')
            .select('id, code, status')
            .eq('production_lot_id', prodLotId);

        if (err1) {
            console.error('Lỗi khi lấy lots:', err1);
            return;
        }

        const activeLotIds = lots.filter(l => l.status === 'active').map(l => l.id);

        // 2. Lấy chi tiết positions bao gồm system_type
        const { data: positions, error: err2 } = await supabase
            .from('positions')
            .select(`
                id,
                code,
                lot_id,
                system_type
            `)
            .in('lot_id', activeLotIds);

        if (err2) {
            console.error('Lỗi khi lấy positions:', err2);
            return;
        }

        console.log(`Tìm thấy ${positions.length} positions:`);
        
        // 3. Lấy zone_positions để xem các positions này nằm ở zone nào
        const posIds = positions.map(p => p.id);
        const { data: zonePositions, error: err3 } = await supabase
            .from('zone_positions')
            .select('position_id, zone_id, zones(name, code, system_type, parent_id)')
            .in('position_id', posIds);

        if (err3) {
            console.error('Lỗi khi lấy zone_positions:', err3);
            return;
        }

        positions.forEach((pos, idx) => {
            const zp = zonePositions.find(z => z.position_id === pos.id);
            const lot = lots.find(l => l.id === pos.lot_id);
            console.log(`Pos #${idx + 1}:`);
            console.log(`  Code: ${pos.code}`);
            console.log(`  System Type: ${pos.system_type}`);
            console.log(`  Lot Code: ${lot ? lot.code : 'N/A'}`);
            if (zp) {
                console.log(`  Zone: ${zp.zones?.name} | Code: ${zp.zones?.code} | Zone System: ${zp.zones?.system_type} | Parent: ${zp.zones?.parent_id}`);
            } else {
                console.log(`  [CẢNH BÁO] Không có Zone liên kết trong zone_positions!`);
            }
        });

    } catch (error) {
        console.error('Lỗi:', error);
    }
}

main();
