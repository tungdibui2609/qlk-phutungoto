// test-db.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase.from('fresh_material_batches').select('id, batch_code, document_urls').limit(5);
    console.log("Batches:", JSON.stringify(data, null, 2));
    if (error) console.error("Error:", error);
}
check();
