const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProduct() {
    console.log('--- Checking Product "Sầu Riêng Cấp Đông Mùi" ---');
    
    const { data: products, error: pError } = await supabase
        .from('products')
        .select('*')
        .ilike('name', '%Sầu Riêng Cấp Đông Mùi%');

    if (pError) {
        console.error('Error fetching products:', pError);
        return;
    }

    if (!products || products.length === 0) {
        console.log('No product found with that name.');
        return;
    }

    for (const p of products) {
        console.log(`\nProduct ID: ${p.id}`);
        console.log(`SKU: ${p.sku}`);
        console.log(`Name: ${p.name}`);
        console.log(`Unit: ${p.unit}`);
        console.log(`Weight KG: ${p.weight_kg}`);

        const { data: pUnits, error: puError } = await supabase
            .from('product_units')
            .select('*, units(name)')
            .eq('product_id', p.id);

        if (puError) {
            console.error('Error fetching product units:', puError);
            continue;
        }

        console.log('Product Units:');
        pUnits.forEach(pu => {
            console.log(`  - Unit: ${pu.units.name} (ID: ${pu.unit_id}), Rate: ${pu.conversion_rate}`);
        });
    }
}

checkProduct();
