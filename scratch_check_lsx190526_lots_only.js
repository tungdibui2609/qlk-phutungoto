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
  console.log("=== CÁC DÒNG LÔ SẢN XUẤT (production_lots) CỦA LỆNH LSX190526 ===");
  const { data: prod } = await supabase
    .from('productions')
    .select('id, code, name, production_lots(*, products(name))')
    .eq('code', 'LSX190526');

  if (prod && prod.length > 0) {
    console.log(JSON.stringify(prod[0].production_lots, null, 2));
  } else {
    console.log("Không tìm thấy lệnh LSX190526");
  }
}

main();
