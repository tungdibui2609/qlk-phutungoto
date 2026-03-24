const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProduct() {
    let output = '--- Searching for product SKU "SRM.CD" ---\n';
    
    const { data: products, error: pError } = await supabase
        .from('products')
        .select('*')
        .eq('sku', 'SRM.CD');

    if (pError) {
        output += `Error fetching products: ${JSON.stringify(pError)}\n`;
    } else if (!products || products.length === 0) {
        output += 'No product found with SKU SRM.CD.\nTrying name search for "Sầu Riêng"...\n';
        const { data: p2 } = await supabase.from('products').select('*').ilike('name', '%Sầu Riêng%').limit(5);
        if (p2) p2.forEach(p => output += `  - ${p.sku}: ${p.name}\n`);
    } else {
        for (const p of products) {
            output += `\nProduct ID: ${p.id}\n`;
            output += `SKU: ${p.sku}\n`;
            output += `Name: ${p.name}\n`;
            output += `Unit: ${p.unit}\n`;
            output += `Weight KG: ${p.weight_kg}\n`;

            const { data: pUnits, error: puError } = await supabase
                .from('product_units')
                .select('*')
                .eq('product_id', p.id);

            if (puError) {
                output += `Error fetching product units: ${JSON.stringify(puError)}\n`;
                continue;
            }

            output += 'Product Units:\n';
            for (const pu of pUnits) {
                const { data: u } = await supabase.from('units').select('name').eq('id', pu.unit_id).single();
                output += `  - Unit: ${u?.name || 'Unknown'} (ID: ${pu.unit_id}), Rate: ${pu.conversion_rate}\n`;
            }
        }
    }
    
    fs.writeFileSync('tmp_debug_output.txt', output, 'utf8');
    console.log('Done. Output written to tmp_debug_output.txt');
}

checkProduct();
