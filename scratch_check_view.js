const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- KHẢO SÁT VIEW PRODUCTION_ITEM_STATISTICS ---');

    try {
        const prodLotId = '85fb6918-8aae-4319-ab54-cf5fab0912d7'; // L034DD260-TN

        // Lấy thông tin từ production_lots trước
        const { data: prodLots, error: err1 } = await supabase
            .from('production_lots')
            .select('id, lot_code')
            .eq('id', prodLotId);

        if (err1) {
            console.error(err1);
            return;
        }

        console.log('Production lot:', prodLots);

        // Query view production_item_statistics
        const { data: stats, error: err2 } = await supabase
            .from('production_item_statistics')
            .select('*')
            .eq('production_lot_id', prodLotId);

        if (err2) {
            console.error(err2);
            return;
        }

        console.log('Stats from view:', JSON.stringify(stats, null, 2));

    } catch (e) {
        console.error(e);
    }
}

main();
