const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // using service role for all privileges
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: dbData, error } = await supabase.rpc('get_lot_items_schema').select('*');
    if (error) {
        console.log("RPC Error (expected if not exist):", error.message);
        const { data, error: err2 } = await supabase.from('lot_items').select('*').limit(1);
        console.log("Lot Items:", JSON.stringify(data?.[0], null, 2));
    } else {
        console.log(dbData);
    }
}
check();
