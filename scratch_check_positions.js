const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- KIỂM TRA PHÂN BỔ VỊ TRÍ CỦA CÁC LÔ ACTIVE ---');

    try {
        const prodLotId = '85fb6918-8aae-4319-ab54-cf5fab0912d7'; // L034DD260-TN

        // 1. Lấy tất cả các lots thuộc L034DD260-TN
        const { data: lots, error: err1 } = await supabase
            .from('lots')
            .select(`
                id,
                code,
                status,
                inbound_date,
                lot_items (
                    id,
                    quantity,
                    unit
                )
            `)
            .eq('production_lot_id', prodLotId);

        if (err1) {
            console.error('Lỗi khi lấy lots:', err1);
            return;
        }

        const activeLots = lots.filter(l => l.status === 'active');
        const activeLotIds = activeLots.map(l => l.id);

        console.log(`Tổng số lô đang hoạt động (active): ${activeLots.length}`);

        // 2. Truy vấn tất cả positions liên kết với các activeLotIds này
        const { data: positions, error: err2 } = await supabase
            .from('positions')
            .select('id, code, lot_id')
            .in('lot_id', activeLotIds);

        if (err2) {
            console.error('Lỗi khi lấy positions:', err2);
            return;
        }

        console.log(`Số vị trí tìm thấy liên kết trực tiếp: ${positions.length}`);

        // 3. Phân tích chi tiết từng active lot
        let assignedLotsCount = 0;
        let unassignedLotsCount = 0;
        let assignedBoxes = 0;
        let unassignedBoxes = 0;

        console.log('\n--- CHI TIẾT CÁC LÔ ĐÃ GÁN VỊ TRÍ ---');
        activeLots.forEach(lot => {
            const lotQty = lot.lot_items ? lot.lot_items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;
            const linkedPositions = positions.filter(p => p.lot_id === lot.id);

            if (linkedPositions.length > 0) {
                assignedLotsCount++;
                assignedBoxes += lotQty;
                console.log(`- Lô: ${lot.code} | Số lượng: ${lotQty} thùng | Vị trí: ${linkedPositions.map(p => p.code).join(', ')}`);
            }
        });

        console.log('\n--- CHI TIẾT CÁC LÔ CHƯA GÁN VỊ TRÍ (positions.lot_id IS NULL) ---');
        activeLots.forEach(lot => {
            const lotQty = lot.lot_items ? lot.lot_items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;
            const linkedPositions = positions.filter(p => p.lot_id === lot.id);

            if (linkedPositions.length === 0) {
                unassignedLotsCount++;
                unassignedBoxes += lotQty;
                console.log(`- Lô: ${lot.code} | Số lượng: ${lotQty} thùng | Ngày nhập: ${lot.inbound_date}`);
            }
        });

        console.log('\n=== TỔNG KẾT ---');
        console.log(`1. ĐÃ GÁN VỊ TRÍ:`);
        console.log(`   - Số lô: ${assignedLotsCount} lô`);
        console.log(`   - Tổng số thùng: ${assignedBoxes} thùng`);
        console.log(`2. CHƯA GÁN VỊ TRÍ:`);
        console.log(`   - Số lô: ${unassignedLotsCount} lô`);
        console.log(`   - Tổng số thùng: ${unassignedBoxes} thùng`);
        console.log(`3. TỔNG SỐ THÙNG HOẠT ĐỘNG: ${assignedBoxes + unassignedBoxes} thùng`);

    } catch (error) {
        console.error('Lỗi hệ thống:', error);
    }
}

main();
