
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim().replace(/^"(.*)"$/, '$1');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    // Get the lot first to get the product ID
    const { data: lot } = await supabase
        .from('lots')
        .select(`
            id, code, product_id,
            products(name, sku, unit)
        `)
        .eq('code', 'LT1003-00008')
        .single();
    
    if (!lot) { console.log('Lot LT1003-00008 not found'); return; }
    
    console.log(`Lot: ${lot.code}, Product ID: ${lot.product_id}, SKU: ${lot.products?.sku}, Name: ${lot.products?.name}`);

    const { data: convs } = await supabase
        .from('product_units')
        .select('*, units(name)')
        .eq('product_id', lot.product_id);
    
    console.log('Conversion Rates:');
    convs?.forEach(c => {
        console.log(`- Unit: ${c.units?.name} (id: ${c.unit_id}), Rate: ${c.conversion_rate}`);
    });

    // Check if there are any other units with numbers in them
    const { data: allUnits } = await supabase.from('units').select('*');
    console.log('Units with weight in name:');
    allUnits.filter(u => /\d/.test(u.name)).forEach(u => console.log(`- ${u.name} (id: ${u.id})`));
}

checkData();
