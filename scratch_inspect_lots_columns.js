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
  console.log("=== KIỂM TRA MỘT PALLET CỦA NGÀY 28/05/2026 THUỘC LỆNH LSX190526 ===");
  const { data: lots, error } = await supabase
    .from('lots')
    .select('*, lot_items(*)')
    .eq('code', 'DL-LOT-280526-013')
    .maybeSingle();

  if (error) {
    console.error("Lỗi:", error);
    return;
  }

  console.log("Pallet DL-LOT-280526-013:", JSON.stringify(lots, null, 2));

  console.log("\n=== KIỂM TRA BẢN GHI KHÁC CỦA NGÀY 30/05/2026 THUỘC LỆNH LSX190526 ===");
  const { data: lot30 } = await supabase
    .from('lots')
    .select('*, lot_items(*)')
    .eq('code', 'DL-LOT-300526-014')
    .maybeSingle();

  console.log("Pallet DL-LOT-300526-014:", JSON.stringify(lot30, null, 2));
}

main();
