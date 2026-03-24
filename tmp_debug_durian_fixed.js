const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';
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
            console.log(`  - Unit: ${pu.units?.name} (ID: ${pu.unit_id}), Rate: ${pu.conversion_rate}`);
        });
    }
}

checkProduct();
