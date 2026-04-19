const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('lot_items').select('*').limit(1);
    console.log("Lot Items:", JSON.stringify(data, null, 2));
    if (error) console.error("Error:", error);
}
check();
