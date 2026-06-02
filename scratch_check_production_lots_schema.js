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
  console.log("=== KIỂM TRA BẢN GHI MẪU TRONG production_lots ===");
  const { data: sample, error } = await supabase
    .from('production_lots')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Lỗi:", error);
    return;
  }

  console.log("Cấu trúc cột hiện có:", sample && sample.length > 0 ? Object.keys(sample[0]) : "Bảng trống rỗng!");
}

main();
