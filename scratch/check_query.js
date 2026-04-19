
const { createClient } = require('@supabase/supabase-js');
// load from .env.local
const fs = require('fs');
const content = fs.readFileSync('.env.local', 'utf-8');
const lines = content.split('\n');
const env = {};
for (const line of lines) {
    if (line.includes('=')) {
        const parts = line.split('=');
        env[parts[0]] = parts[1].trim();
    }
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    let query = supabase.from('lots').select(`
        id, code, system_code, warehouse_name
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(10);
    
    const { data, error } = await query;
    if (error) {
        console.error("ERROR", error);
        return;
    }
    
    console.log("Found lots:", data.length);
    if (data.length > 0) {
        console.log("Lot warehouse:", data[0].warehouse_name);
        console.log("Lot date:", data[0].inbound_date);
    }
}

check();
