
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGhostGoods() {
    console.log('Checking for ghost goods...');
    
    // Get all positions with lot_id
    const { data: positions, error: pError } = await supabase
        .from('positions')
        .select('id, code, lot_id, system_type')
        .not('lot_id', 'is', null);
        
    if (pError) {
        console.error('Error fetching positions:', pError);
        return;
    }
    
    console.log(`Found ${positions.length} positions with lot_id.`);
    
    const ghostPositions = [];
    
    for (const pos of positions) {
        // Fetch lot details
        const { data: lot, error: lError } = await supabase
            .from('lots')
            .select('id, code, lot_items(quantity)')
            .eq('id', pos.lot_id)
            .single();
            
        if (lError) {
            console.log(`Position ${pos.code} (${pos.id}) has lot_id ${pos.lot_id} but lot not found!`);
            ghostPositions.push(pos);
            continue;
        }
        
        const totalQty = (lot.lot_items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
        if (totalQty === 0) {
            console.log(`Position ${pos.code} (${pos.id}) has lot ${lot.code} with 0 quantity.`);
            ghostPositions.push(pos);
        }
    }
    
    console.log(`\nTotal ghost positions found: ${ghostPositions.length}`);
}

checkGhostGoods();
