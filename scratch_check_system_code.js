const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    try {
        const prodLotId = '85fb6918-8aae-4319-ab54-cf5fab0912d7'; // L034DD260-TN
        const { data: lots, error } = await supabase
            .from('lots')
            .select('id, code, system_code')
            .eq('production_lot_id', prodLotId);

        if (error) {
            console.error(error);
            return;
        }

        console.log(`Tìm thấy ${lots.length} lots.`);
        console.log('Mẫu lots:', lots.slice(0, 5));
        
        const systemCodes = Array.from(new Set(lots.map(l => l.system_code)));
        console.log('Các system_code duy nhất:', systemCodes);
    } catch (e) {
        console.error(e);
    }
}

main();
