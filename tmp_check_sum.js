
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSum() {
    const { data: tags } = await supabase
        .from('lot_tags')
        .select('tag, lot_id, lots(system_code, warehouse_name), lot_items(quantity, unit)')
        .ilike('tag', '%băng keo trong%');

    let totalRaw = 0;
    tags?.forEach(t => {
        t.lot_items?.forEach(i => {
            totalRaw += i.quantity;
        });
    });

    console.log(`Tag "BĂNG KEO TRONG" total quantity in DB: ${totalRaw}`);
    console.log("Details:", JSON.stringify(tags, null, 2));
}

checkSum();
