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
  console.log("=== KIỂM TRA PALLET DL-LOT-300526-079 ===");
  const { data: lot, error } = await supabase
    .from('lots')
    .select('*, lot_items(*, products(name, sku))')
    .eq('code', 'DL-LOT-300526-079')
    .maybeSingle();

  if (error) {
    console.error("Lỗi:", error);
    return;
  }

  console.log("Dữ liệu Pallet:", JSON.stringify(lot, null, 2));

  console.log("\n=== KIỂM TRA LÔ SẢN XUẤT LSX230526 ===");
  const { data: pl } = await supabase
    .from('production_lots')
    .select('*, products(name, sku)')
    .eq('lot_code', 'LSX230526');

  console.log("Production Lot LSX230526:", JSON.stringify(pl, null, 2));
}

main();
