const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) envVars[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
});
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('products').select('id, name, sku, aliases, system_type').not('aliases', 'is', null);
  console.log('Total products with aliases:', data?.length);
  console.log('Products:', JSON.stringify(data, null, 2));

  // Also let's search for products with "hạt" or "Dona" in name
  const { data: prods } = await supabase.from('products').select('id, name, sku, aliases, system_type').or('name.ilike.%hạt%,name.ilike.%dona%').limit(10);
  console.log('Sample products with hạt or dona:', JSON.stringify(prods, null, 2));
}
run();
