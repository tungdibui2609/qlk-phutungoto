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
  console.log("------------------- TRUY VẤN MÃ LOT: DL-LOT-240626-096 -------------------");

  // 1. Kiểm tra trong bảng lots
  console.log("\n1. Tra cứu trong bảng 'lots'...");
  const { data: lots, error: errorLots } = await supabase
    .from('lots')
    .select('*, productions(code, name), lot_items(*, products(name))')
    .eq('code', 'DL-LOT-240626-096');
  
  if (errorLots) {
    console.error("Lỗi khi tra cứu bảng lots:", errorLots);
  } else {
    console.log(`Tìm thấy ${lots.length} bản ghi trong lots:`);
    console.log(JSON.stringify(lots, null, 2));
  }

  // 2. Kiểm tra trong bảng production_lots theo production_lot_id
  if (lots && lots.length > 0 && lots[0].production_lot_id) {
    const plId = lots[0].production_lot_id;
    console.log(`\n2. Tra cứu trong bảng 'production_lots' với id: ${plId}...`);
    const { data: productionLots, error: errorPL } = await supabase
      .from('production_lots')
      .select('*, products(name), productions(code, name, status, created_at)')
      .eq('id', plId);

    if (errorPL) {
      console.error("Lỗi khi tra cứu bảng production_lots:", errorPL);
    } else {
      console.log(`Tìm thấy ${productionLots.length} bản ghi trong production_lots:`);
      console.log(JSON.stringify(productionLots, null, 2));
    }
  }
}

main();
