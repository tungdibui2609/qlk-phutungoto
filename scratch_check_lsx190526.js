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
  console.log("=== KIỂM TRA LỆNH LSX190526 ===");
  const { data: prod } = await supabase
    .from('productions')
    .select('*, production_lots(*, products(name))')
    .eq('code', 'LSX190526');

  console.log("Lệnh sản xuất LSX190526:", JSON.stringify(prod, null, 2));

  if (prod && prod.length > 0) {
    const prodId = prod[0].id;
    console.log(`\n=== TẤT CẢ PALLET THỰC TẾ (lots) THUỘC LỆNH LSX190526 ===`);
    const { data: lots } = await supabase
      .from('lots')
      .select('*, lot_items(*, products(name))')
      .eq('production_id', prodId);

    console.log(`Tìm thấy ${lots ? lots.length : 0} pallet:`);
    lots?.forEach((l, idx) => {
      console.log(`${idx + 1}. Pallet: ${l.code}, production_lot_id: ${l.production_lot_id}, Ngày tạo: ${l.created_at}, SL: ${l.quantity}`);
      l.lot_items?.forEach(item => {
        console.log(`   - Sản phẩm: ${item.products?.name} (ID: ${item.product_id}), SL: ${item.quantity}`);
      });
    });
  }
}

main();
