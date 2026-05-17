const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- KIỂM TRA HIERARCHY CỦA CÁC ZONE LIÊN QUAN ---');

    try {
        const prodLotId = '85fb6918-8aae-4319-ab54-cf5fab0912d7'; // L034DD260-TN

        // 1. Lấy tất cả active lots
        const { data: lots } = await supabase
            .from('lots')
            .select('id')
            .eq('production_lot_id', prodLotId);

        const activeLotIds = lots.map(l => l.id);

        // 2. Lấy positions
        const { data: positions } = await supabase
            .from('positions')
            .select('id, code, lot_id')
            .in('lot_id', activeLotIds);

        const posIds = positions.map(p => p.id);

        // 3. Lấy zone_positions
        const { data: zonePositions } = await supabase
            .from('zone_positions')
            .select('position_id, zone_id')
            .in('position_id', posIds);

        const zoneIds = Array.from(new Set(zonePositions.map(zp => zp.zone_id)));

        // 4. Lấy thông tin các zone này
        const { data: zones } = await supabase
            .from('zones')
            .select('id, name, code, is_hall, level, parent_id')
            .in('id', zoneIds);

        console.log('--- CÁC ZONE TRỰC TIẾP CHỨA VỊ TRÍ ---');
        console.log(JSON.stringify(zones, null, 2));

        // 5. Tìm tất cả các ancestor zones (cha, ông...) cho đến root
        const allZoneIds = new Set(zoneIds);
        let currentLevelIds = [...zoneIds];

        while (currentLevelIds.length > 0) {
            const { data: parentZones } = await supabase
                .from('zones')
                .select('id, name, code, is_hall, level, parent_id')
                .in('id', currentLevelIds.map(z => z).filter(Boolean));

            if (!parentZones || parentZones.length === 0) break;

            const nextLevelIds = [];
            parentZones.forEach(pz => {
                if (pz.parent_id && !allZoneIds.has(pz.parent_id)) {
                    allZoneIds.add(pz.parent_id);
                    nextLevelIds.push(pz.parent_id);
                }
            });
            currentLevelIds = nextLevelIds;
        }

        const { data: fullZones } = await supabase
            .from('zones')
            .select('id, name, code, is_hall, level, parent_id')
            .in('id', Array.from(allZoneIds));

        console.log('\n--- TOÀN BỘ CÂY ZONE LIÊN QUAN ---');
        console.log(JSON.stringify(fullZones, null, 2));

        // 6. Kiểm tra xem có zone nào có thuộc tính is_hall = true (Sảnh) hay không?
        const halls = fullZones.filter(z => z.is_hall);
        console.log(`\nTìm thấy ${halls.length} Sảnh liên quan:`);
        halls.forEach(h => console.log(`- Sảnh: ${h.name} (${h.code}) | ID: ${h.id}`));

    } catch (e) {
        console.error(e);
    }
}

main();
