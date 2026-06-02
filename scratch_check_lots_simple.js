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
  console.log("------------------- CHI TIẾT DL-LOT-110526-4104 -------------------");
  const { data: plots } = await supabase
    .from('production_lots')
    .select('*, products(name, code), productions(code, name, status, created_at)')
    .eq('lot_code', 'DL-LOT-110526-4104');
  console.log("Trong production_lots:", JSON.stringify(plots, null, 2));

  const { data: lots } = await supabase
    .from('lots')
    .select('*, productions(code, name), lot_items(*, products(name))')
    .or('code.eq.DL-LOT-110526-4104,production_code.eq.DL-LOT-110526-4104');
  console.log("Trong lots:", JSON.stringify(lots, null, 2));

  console.log("------------------- CHI TIẾT DL-LOT-200526-032 -------------------");
  const { data: plots2 } = await supabase
    .from('production_lots')
    .select('*, products(name, code), productions(code, name, status, created_at)')
    .eq('lot_code', 'DL-LOT-200526-032');
  console.log("Trong production_lots:", JSON.stringify(plots2, null, 2));

  const { data: lots2 } = await supabase
    .from('lots')
    .select('*, productions(code, name), lot_items(*, products(name))')
    .or('code.eq.DL-LOT-200526-032,production_code.eq.DL-LOT-200526-032');
  console.log("Trong lots:", JSON.stringify(lots2, null, 2));

  // Kiểm tra lệnh LSX030526 xem mã lô sản xuất được định nghĩa thế nào
  console.log("------------------- CHI TIẾT LỆNH LSX030526 -------------------");
  const { data: prod } = await supabase
    .from('productions')
    .select('*, production_lots(*, products(name))')
    .eq('code', 'LSX030526');
  console.log("Lệnh LSX030526:", JSON.stringify(prod, null, 2));
}

main();
