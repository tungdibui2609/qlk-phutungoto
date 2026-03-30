const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
    const { data } = await supabase.from('lots').select('id, lot_code, inbound_date, production_lot_id, quantity').limit(10);
    console.log("Ten lots:");
    console.log(data);

    // Let's get the production lot ids from the screen
    console.log("Production Lots:");
    const { data: prodLots } = await supabase.from('production_lots').select('*').like('lot_code', '%LSX%').limit(5);
    console.log(prodLots);
    
    // Check if there are warehouse lots linked to the production lot from the picture
    if (prodLots && prodLots.length > 0) {
        const prodId = prodLots[0].id; // Example
        const { data: wLots } = await supabase.from('lots').select('*').eq('production_lot_id', prodId);
        console.log("Warehouse Lots for production lot 1:");
        console.log(wLots);
    }
}
test();
