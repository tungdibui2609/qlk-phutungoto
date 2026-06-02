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
  const plId = 'ab43ee65-a4eb-4b68-a1b8-873134a49d00';
  console.log("=== KIỂM TRA VIEW production_item_statistics CHO LÔ ab43ee65-a4eb-4b68-a1b8-873134a49d00 ===");
  const { data, error } = await supabase
    .from('production_item_statistics')
    .select('*')
    .eq('production_lot_id', plId);

  console.log("Kết quả từ view:", data, "Lỗi:", error);

  // Xem định nghĩa hoặc query thủ công giống như trong định nghĩa view
  console.log("\n=== TÍNH TOÁN THỦ CÔNG TỪ BẢNG lots VÀ lot_items ===");
  const { data: lots, error: errLots } = await supabase
    .from('lots')
    .select('id, code, quantity, production_lot_id, lot_items(product_id, quantity)')
    .eq('production_lot_id', plId);

  console.log("Các lots liên kết:", JSON.stringify(lots, null, 2));
}

main();
