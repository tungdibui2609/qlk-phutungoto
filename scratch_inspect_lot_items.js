const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- KIỂM TRA LOT ITEMS CỦA 2 LÔ ĐẶC BIỆT ---');

    try {
        const codes = ['DL-LOT-130526-077', 'DL-LOT-140526-051'];
        const { data: lots, error } = await supabase
            .from('lots')
            .select(`
                id,
                code,
                status,
                lot_items (
                    id,
                    quantity,
                    initial_quantity,
                    unit
                )
            `)
            .in('code', codes);

        if (error) {
            console.error(error);
            return;
        }

        console.log(JSON.stringify(lots, null, 2));

    } catch (e) {
        console.error(e);
    }
}

main();
