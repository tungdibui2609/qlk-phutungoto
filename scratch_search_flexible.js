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
  console.log("=== TÌM KIẾM LINH HOẠT VỚI 'L036' ===");
  const { data: d1 } = await supabase
    .from('production_lots')
    .select('*, products(name), productions(code)')
    .ilike('lot_code', '%L036%');
  console.log("Tìm thấy trong production_lots:", JSON.stringify(d1, null, 2));

  const { data: d2 } = await supabase
    .from('lots')
    .select('*, productions(code)')
    .or('code.ilike.%L036%,production_code.ilike.%L036%');
  console.log("Tìm thấy trong lots:", JSON.stringify(d2, null, 2));

  console.log("\n=== TÌM KIẾM LINH HOẠT VỚI 'TN' ===");
  const { data: d3 } = await supabase
    .from('production_lots')
    .select('*, products(name), productions(code)')
    .ilike('lot_code', '%TN%');
  console.log("Tìm thấy trong production_lots với TN:", JSON.stringify(d3, null, 2));

  const { data: d4 } = await supabase
    .from('lots')
    .select('*, productions(code)')
    .or('code.ilike.%TN%,production_code.ilike.%TN%');
  console.log("Tìm thấy trong lots với TN:", JSON.stringify(d4, null, 2));
}

main();
