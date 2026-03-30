import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
    const { data: wLots } = await supabase.from('lots').select('id, lot_code, inbound_date, production_lot_id, quantity').not('production_lot_id', 'is', null).limit(10);
    console.log("Warehouse Lots linked to production:");
    console.log(wLots);
}
test();
