const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

async function main() {
  const plId = '0ccb432e-340e-4140-943a-d4497161dd83';
  console.log("=== KIỂM TRA LOT_ITEMS CỦA PALLET DL-LOT-230526-021 ===");
  const { data: items1 } = await supabase
    .from('lot_items')
    .select('*, products(name, sku)')
    .eq('lot_id', 'a197d17a-b21b-44cf-a95b-82ae0b0c409c');
  console.log(JSON.stringify(items1, null, 2));

  console.log("\n=== KIỂM TRA LOT_ITEMS CỦA PALLET DL-LOT-300526-079 ===");
  const { data: items2 } = await supabase
    .from('lot_items')
    .select('*, products(name, sku)')
    .eq('lot_id', '6e66d92e-cd61-42e8-9f38-420e5799e3a7');
  console.log(JSON.stringify(items2, null, 2));
}

main();
