
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    'https://viqeyhpnevxcowsffueb.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U'
);

async function checkData() {
    const { data: units } = await supabase.from('units').select('id, name');
    const unitMap = {};
    units.forEach(u => unitMap[u.id] = u.name);

    const { data: products } = await supabase.from('products')
        .select('*')
        .ilike('name', '%Sầu riêng%');
    
    let output = '';
    if (products && products.length > 0) {
        for (const p of products) {
            output += `Product: ${p.name} (SKU: ${p.sku}) ID: ${p.id} Base: ${p.unit}\n`;
            const { data: pUnits } = await supabase.from('product_units')
                .select('*')
                .eq('product_id', p.id);
            if (pUnits) {
                pUnits.forEach(pu => {
                    output += `  - 1 ${unitMap[pu.unit_id] || pu.unit_id} = ${pu.conversion_rate} ${p.unit}\n`;
                });
            }
            output += '\n';
        }
    }
    fs.writeFileSync('d:/chanh thu/web/tmp/debug_output.txt', output);
    console.log('Output written to d:/chanh thu/web/tmp/debug_output.txt');
}

checkData();
