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
  const prodId = '4322e353-68e2-4a1a-95ba-772391e76d6b'; // LSX040426
  
  console.log("=== DANH SÁCH TẤT CẢ PALLET CỦA LỆNH LSX040426 ===");
  const { data: lots, error } = await supabase
    .from('lots')
    .select('id, code, daily_seq, quantity, created_at, lot_items(*, products(name))')
    .eq('production_id', prodId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Lỗi:", error);
    return;
  }

  console.log(`Tìm thấy ${lots.length} pallet:`);
  lots.forEach((l, idx) => {
    console.log(`${idx + 1}. Pallet: ${l.code} (STT: ${l.daily_seq}), SL: ${l.quantity}, Ngày tạo: ${l.created_at}`);
  });
}

main();
