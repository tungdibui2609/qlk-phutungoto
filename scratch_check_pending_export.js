const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- KIỂM TRA PENDING EXPORT TRÊN 39 POSITIONS ---');

    try {
        const prodLotId = '85fb6918-8aae-4319-ab54-cf5fab0912d7'; // L034DD260-TN

        // 1. Lấy tất cả active lots
        const { data: lots } = await supabase
            .from('lots')
            .select('id, code')
            .eq('production_lot_id', prodLotId)
            .eq('status', 'active');

        const activeLotIds = lots.map(l => l.id);

        // 2. Lấy positions
        const { data: positions } = await supabase
            .from('positions')
            .select('id, code, lot_id')
            .in('lot_id', activeLotIds);

        const posIds = positions.map(p => p.id);

        // 3. Lấy tất cả export tasks liên quan đến các positions hoặc lots này
        const { data: exportTaskItems, error } = await supabase
            .from('export_task_items')
            .select(`
                position_id,
                lot_id,
                export_tasks (
                    id,
                    status,
                    system_code
                )
            `)
            .in('lot_id', activeLotIds);

        if (error) {
            console.error('Lỗi fetch export items:', error);
            return;
        }

        console.log(`Tìm thấy ${exportTaskItems.length} bản ghi export_task_items liên quan.`);

        // Lọc các items có status của task là Pending hoặc Processing
        const activeExportItems = exportTaskItems.filter(item => {
            const status = item.export_tasks?.status;
            return ['Pending', 'Processing'].includes(status);
        });

        console.log(`Trong đó có ${activeExportItems.length} bản ghi đang ở trạng thái Pending hoặc Processing:`);
        activeExportItems.forEach((item, idx) => {
            const pos = positions.find(p => p.id === item.position_id || p.lot_id === item.lot_id);
            const lot = lots.find(l => l.id === item.lot_id);
            console.log(`- #${idx + 1}: Vị trí: ${pos ? pos.code : 'N/A'} (ID: ${item.position_id}) | Lô: ${lot ? lot.code : 'N/A'} | Status Task: ${item.export_tasks?.status}`);
        });

    } catch (e) {
        console.error(e);
    }
}

main();
