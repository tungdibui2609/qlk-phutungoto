const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('fresh_material_batches')
        .select('id, batch_code, system_code, status, products(name)');
    console.log('--- FRESH MATERIAL BATCHES ---');
    console.log('Data:', JSON.stringify(data, null, 2));
    if (error) console.log('Error:', error);
}

check();
