const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- KIỂM TRA SỐ LƯỢNG THỰC TẾ CỦA 39 LÔ ĐÃ GÁN VỊ TRÍ ---');

    try {
        const prodLotId = '85fb6918-8aae-4319-ab54-cf5fab0912d7'; // L034DD260-TN

        // 1. Lấy tất cả lots
        const { data: lots, error: err1 } = await supabase
            .from('lots')
            .select(`
                id,
                code,
                status,
                lot_items (
                    id,
                    quantity,
                    unit
                )
            `)
            .eq('production_lot_id', prodLotId);

        if (err1) {
            console.error(err1);
            return;
        }

        const activeLots = lots.filter(l => l.status === 'active');

        // 2. Lấy positions liên kết
        const activeLotIds = activeLots.map(l => l.id);
        const { data: positions, error: err2 } = await supabase
            .from('positions')
            .select('id, code, lot_id')
            .in('lot_id', activeLotIds);

        if (err2) {
            console.error(err2);
            return;
        }

        console.log(`Tìm thấy ${positions.length} positions đã gán lot active.`);

        let zeroQtyLotsCount = 0;

        positions.forEach((pos, idx) => {
            const lot = activeLots.find(l => l.id === pos.lot_id);
            if (lot) {
                const totalQty = lot.lot_items ? lot.lot_items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;
                console.log(`Pos #${idx + 1}: Vị trí ${pos.code} | Lô ${lot.code} | Số lượng hiện tại: ${totalQty} thùng`);
                if (totalQty === 0) {
                    zeroQtyLotsCount++;
                }
            } else {
                console.log(`Pos #${idx + 1}: Vị trí ${pos.code} | [CẢNH BÁO] Không tìm thấy Lot liên kết!`);
            }
        });

        console.log(`\nTổng số lô có số lượng bằng 0: ${zeroQtyLotsCount}`);

    } catch (e) {
        console.error(e);
    }
}

main();
