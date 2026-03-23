const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugProductionStats() {
    const prodCode = 'LSX-20260323-8051';
    console.log(`Debugging for Production Code: ${prodCode}`);

    // 1. Get Production ID
    const { data: prod } = await supabase
        .from('productions')
        .select('id')
        .eq('code', prodCode)
        .single();
    
    if (!prod) {
        console.log('Production not found');
        return;
    }
    const prodId = prod.id;
    console.log(`Production ID: ${prodId}`);

    // 2. Check production_lots
    const { data: pLots } = await supabase
        .from('production_lots')
        .select('id, lot_code, product_id, products(name, sku)')
        .eq('production_id', prodId);
    
    console.log(`--- Items in this Production Order (${pLots?.length || 0}) ---`);
    pLots?.forEach(pl => console.log(`PL ID: ${pl.id} | Product: [${pl.products?.name}] | Lot Code: [${pl.lot_code}]`));

    // 3. Check lots linked to this Production
    const { data: lots } = await supabase
        .from('lots')
        .select('id, code, production_id')
        .eq('production_id', prodId);
    
    console.log(`--- Lots linked to this Production (${lots?.length || 0}) ---`);
    lots?.forEach(l => console.log(`Lot Code: [${l.code}] | ID: ${l.id}`));

    // 4. Check lot_items matching logic
    if (lots && lots.length > 0 && pLots && pLots.length > 0) {
        console.log('--- Testing Matching for first production_lot ---');
        const pl = pLots[0];
        const { data: matchedItems } = await supabase
            .from('lot_items')
            .select('*, lots!inner(*), products(name, sku)')
            .eq('lots.production_id', prodId)
            .or(`product_id.eq.${pl.product_id},products.sku.eq.${pl.products.sku}`); // simplified match
        
        console.log(`Found ${matchedItems?.length || 0} matched items for Product [${pl.products.name}]`);
        matchedItems?.forEach(mi => {
            console.log(`- Item Lot Code: [${mi.lots.code}] | Qty: ${mi.quantity} | Unit: ${mi.unit}`);
            const codeMatch = mi.lots.code.trim().toUpperCase() === pl.lot_code.trim().toUpperCase();
            console.log(`  Code Match [${mi.lots.code}] vs [${pl.lot_code}] -> ${codeMatch}`);
        });
    }

    // 5. Test the view result directly
    const { data: stats } = await supabase
        .from('production_item_statistics')
        .select('*')
        .eq('production_lot_id', pLots?.[0]?.id);
    console.log('--- View Result for first item ---');
    console.log(JSON.stringify(stats, null, 2));
}

debugProductionStats();
