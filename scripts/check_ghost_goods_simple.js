
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE';
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
            console.log(`Position ${pos.code} (${pos.id}) has lot_id ${pos.lot_id} but lot not found in 'lots' table!`);
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
    if (ghostPositions.length > 0) {
        console.log('Sample ghost positions:', ghostPositions.slice(0, 5).map(p => p.code).join(', '));
    }
}

checkGhostGoods();
