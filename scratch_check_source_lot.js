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
  console.log("------------------- TRUY VẤN LỊCH SỬ LOT NGUỒN DL-LOT-010626-002 -------------------");
  
  // Truy vấn lot nguồn
  const { data: lot, error } = await supabase
    .from('lots')
    .select(`
      *,
      lot_items!lot_items_lot_id_fkey(*),
      lot_tags(*)
    `)
    .eq('code', 'DL-LOT-010626-002')
    .single();

  if (error) {
    console.error("Lỗi:", error);
    return;
  }

  console.log("Lot Nguồn:", JSON.stringify(lot, null, 2));
}

main();
