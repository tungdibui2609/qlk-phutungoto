const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- KIỂM TRA COMPANY_ID CỦA 39 LOTS ---');

    try {
        const prodLotId = '85fb6918-8aae-4319-ab54-cf5fab0912d7'; // L034DD260-TN

        // 1. Lấy tất cả active lots
        const { data: lots, error: err1 } = await supabase
            .from('lots')
            .select('id, code, company_id, status')
            .eq('production_lot_id', prodLotId);

        if (err1) {
            console.error(err1);
            return;
        }

        const activeLots = lots.filter(l => l.status === 'active');
        console.log(`Có ${activeLots.length} active lots.`);

        const companyIds = Array.from(new Set(activeLots.map(l => l.company_id)));

        console.log('Các company_id duy nhất:', companyIds);

        activeLots.forEach((l, idx) => {
            console.log(`Lot #${idx + 1}: ${l.code} | Company ID: ${l.company_id}`);
        });

    } catch (e) {
        console.error(e);
    }
}

main();
