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
  console.log("=== QUÉT TOÀN BỘ GIÁ TRỊ TRONG CỘT production_code CỦA BẢNG lots ===");
  const { data: lots, error } = await supabase
    .from('lots')
    .select('id, code, production_code, created_at')
    .not('production_code', 'is', null);

  if (error) {
    console.error("Lỗi:", error);
    return;
  }

  const matches = [];
  lots.forEach(l => {
    if (l.production_code.includes('TN') || l.production_code.includes('260') || l.production_code.includes('L036') || l.production_code.includes('DD')) {
      matches.push(l);
    }
  });

  console.log(`Tìm thấy ${matches.length} bản ghi khớp điều kiện:`);
  matches.forEach(m => {
    console.log({
      id: m.id,
      code: m.code,
      production_code: m.production_code,
      created_at: m.created_at
    });
  });
}

main();
