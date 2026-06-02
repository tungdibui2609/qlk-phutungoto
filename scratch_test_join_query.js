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
  console.log("=== KIỂM TRA QUERY TRUY VẾT LIÊN KẾT ===");
  
  // Lấy thử 1 bản ghi box_labels có lot_id để kiểm tra join
  const { data, error } = await supabase
    .from('box_labels')
    .select(`
        id,
        code,
        semi_finished_lot_code,
        finished_lot_code,
        status,
        lots (
            id,
            code,
            positions!positions_lot_id_fkey (
                code
            )
        )
    `)
    .limit(5);

  if (error) {
    console.error("Lỗi query join:", error);
    return;
  }

  console.log("Kết quả query join mẫu:");
  console.log(JSON.stringify(data, null, 2));
}

main();
