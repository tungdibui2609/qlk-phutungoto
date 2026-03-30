import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
    // 1. Find the production lot
    const { data: pLot } = await supabase.from('production_lots').select('*').eq('lot_code', 'LSX-20260326-4986-L1');
    console.log("Production Lot:", pLot);

    if (pLot && pLot.length > 0) {
        // 2. Find warehouse lots linked to it
        const { data: wLots } = await supabase.from('lots').select('*').eq('production_lot_id', pLot[0].id);
        console.log("Warehouse Lots:", wLots);

        if (wLots && wLots.length > 0) {
            // 3. Find lot items for these warehouse lots
            const wLotIds = wLots.map(l => l.id);
            const { data: lItems } = await supabase.from('lot_items').select('*').in('lot_id', wLotIds);
            console.log("Lot Items:", lItems);
        }
    } else {
        // Find ANY production lot that has LSX-20260326-4986
        const { data: pLots } = await supabase.from('production_lots').select('*').like('lot_code', '%LSX-20260326-4986%');
        console.log("Similar Production Lots:", pLots);
    }
}
test();
