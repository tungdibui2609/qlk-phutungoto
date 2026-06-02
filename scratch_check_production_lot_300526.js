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
  console.log("=== TRUY VẤN MÃ LÔ SẢN XUẤT DL-LOT-300526-032 ===");
  const { data: plots } = await supabase
    .from('production_lots')
    .select('*, products(name), productions(code, name)')
    .eq('lot_code', 'DL-LOT-300526-032');
  console.log("Kết quả:", JSON.stringify(plots, null, 2));

  console.log("\n=== TẤT CẢ LÔ SẢN XUẤT CỦA LỆNH LSX040426 ===");
  const { data: plotsLSX } = await supabase
    .from('production_lots')
    .select('*, products(name)')
    .eq('production_id', '4322e353-68e2-4a1a-95ba-772391e76d6b');
  console.log("Kết quả production_lots của LSX040426:", JSON.stringify(plotsLSX, null, 2));
}

main();
