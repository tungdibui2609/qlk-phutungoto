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
  console.log("------------------- CHI TIẾT PALLET DL-LOT-300526-078 -------------------");
  const { data: lot, error } = await supabase
    .from('lots')
    .select('*, productions(code, name), lot_items(*, products(name))')
    .eq('code', 'DL-LOT-300526-078');

  console.log("Dữ liệu Pallet:", JSON.stringify(lot, null, 2));

  if (lot && lot.length > 0) {
    const plId = lot[0].production_lot_id;
    console.log("production_lot_id:", plId);
    if (plId) {
      const { data: pl } = await supabase
        .from('production_lots')
        .select('*, products(name)')
        .eq('id', plId);
      console.log("Production Lot liên kết hiện tại:", JSON.stringify(pl, null, 2));
    }
  }
}

main();
