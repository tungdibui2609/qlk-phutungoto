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
  console.log("=== THỬ NGHIỆM JOIN BẢNG lots VÀ production_lots ===");
  const { data, error } = await supabase
    .from('lots')
    .select('id, code, production_lot_id, production_lots(id, lot_code, production_date)')
    .not('production_lot_id', 'is', null)
    .limit(5);

  if (error) {
    console.error("Lỗi join:", error);
  } else {
    console.log("Kết quả join thành công:", JSON.stringify(data, null, 2));
  }
}

main();
