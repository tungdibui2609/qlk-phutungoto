const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    envVars[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function testQuery() {
    console.log('Testing query for KHO_DONG_LANH positions...');
    try {
        const { data, error } = await supabase
            .from('positions')
            .select(`
                id,
                code,
                lot_id,
                lots!positions_lot_id_fkey (
                    id,
                    code,
                    production_code,
                    status,
                    lot_items (
                        id,
                        quantity,
                        unit,
                        product_id,
                        products (
                            name,
                            sku
                        )
                    )
                )
            `)
            .eq('system_type', 'KHO_DONG_LANH')
            .not('lot_id', 'is', null);

        if (error) {
            console.error('Error executing query:', error);
            return;
        }

        console.log(`Found ${data.length} positions with lots.`);
        const k3d = data.find(p => p.code === 'K3D4A08T201');
        if (k3d) {
            console.log('Position K3D4A08T201 is in the results:', JSON.stringify(k3d, null, 2));
        } else {
            console.log('Position K3D4A08T201 is NOT in the results.');
            console.log('First 5 results:', JSON.stringify(data.slice(0, 5), null, 2));
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

testQuery();
