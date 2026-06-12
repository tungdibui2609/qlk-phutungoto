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

async function inspectPosition() {
    console.log('Inspecting position K3D4A08T201...');
    try {
        const { data, error } = await supabase
            .from('positions')
            .select(`
                id,
                code,
                lot_id,
                system_type,
                lots!positions_lot_id_fkey (
                    id,
                    code,
                    production_code,
                    status,
                    system_code,
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
            .eq('code', 'K3D4A08T201')
            .single();

        if (error) {
            console.error('Error fetching position:', error);
            return;
        }

        console.log('Position Data:');
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Exception:', e);
    }
}

inspectPosition();
