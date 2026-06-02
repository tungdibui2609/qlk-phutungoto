const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Đọc thông tin kết nối từ .env.local
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
  console.log("=== KIỂM TRA 20 BẢN GHI GẦN NHẤT TRONG box_labels ===");
  const { data, error } = await supabase
    .from('box_labels')
    .select('id, code, semi_finished_lot_code, finished_lot_code, product_id, system_code, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error("Lỗi truy vấn:", error);
    return;
  }

  if (!data || data.length === 0) {
    console.log("Không có bản ghi nào trong bảng box_labels!");
    return;
  }

  data.forEach((row, idx) => {
    console.log(`[#${idx + 1}] Code: ${row.code} | BTP: ${row.semi_finished_lot_code} | TP: ${row.finished_lot_code} | SP: ${row.product_id} | SysCode: ${row.system_code} | Ngày tạo: ${row.created_at}`);
  });
}

main();
