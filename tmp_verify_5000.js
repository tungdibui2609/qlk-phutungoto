
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
    const { data: lots, error } = await supabase
        .from('lots')
        .select(`
        id,
        code,
        warehouse_name,
        system_code,
        status,
        lot_items (
            id,
            product_id,
            quantity,
            unit
        ),
        lot_tags (
            tag,
            lot_item_id
        )
    `)
        .neq('status', 'hidden')
        .eq('system_code', 'KHO_DONG_LANH')
        .limit(5000);

    if (error) {
        console.error(error);
        return;
    }

    console.log("Total lots fetched:", lots.length);

    const tags = new Set();
    lots.forEach(lot => {
        lot.lot_tags?.forEach(t => tags.add(t.tag));
    });

    console.log("All tags found in these lots:", Array.from(tags).filter(t => t.includes('COCONUT') || t.includes('BĂNG KEO')));
}

verify();
