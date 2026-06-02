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
  console.log("=== KIỂM TRA CÁC VỊ TRÍ VÀ LOT TẠI KHO 2 - DÃY 4 - Ô 03 ===");
  
  // 1. Query các vị trí có code bắt đầu bằng K2D4 và chứa '03T'
  const { data: positions, error: posError } = await supabase
    .from('positions')
    .select('id, code, lot_id, system_type, company_id')
    .ilike('code', 'K2D4%03T%')
    .order('code');

  if (posError) {
    console.error("Lỗi query positions:", posError);
    return;
  }

  console.log(`Tìm thấy ${positions.length} vị trí:`);
  console.log(JSON.stringify(positions, null, 2));

  // 2. Lấy danh sách các lot_id
  const lotIds = positions.map(p => p.lot_id).filter(Boolean);
  if (lotIds.length === 0) {
    console.log("Không có LOT nào được gán tại các vị trí này.");
    return;
  }

  console.log(`\nDanh sách lot_ids liên kết:`, lotIds);

  // 3. Query chi tiết thông tin các LOT này
  const { data: lots, error: lotsError } = await supabase
    .from('lots')
    .select('*, lot_items(*, products(name)), positions!positions_lot_id_fkey(code)')
    .in('id', lotIds);

  if (lotsError) {
    console.error("Lỗi query lots:", lotsError);
    return;
  }

  console.log(`\nChi tiết các LOT trong database (${lots.length} records):`);
  lots.forEach(l => {
    console.log(`- LOT ID: ${l.id}`);
    console.log(`  Code: ${l.code}`);
    console.log(`  Status: ${l.status}`);
    console.log(`  System Code: ${l.system_code}`);
    console.log(`  Company ID: ${l.company_id}`);
    console.log(`  Daily Seq: ${l.daily_seq}`);
    console.log(`  Vị trí (theo lots.positions):`, l.positions?.map(p => p.code));
    console.log(`  Items:`, l.lot_items?.map(item => `${item.products?.name} - ${item.quantity} ${item.unit}`));
    console.log('--------------------------------------------');
  });

  // 4. Kiểm tra xem RLS hoặc system_code có khớp không
  console.log("\n=== KIỂM TRA SỰ KHÁC BIỆT GIỮA CÁC PHÂN HỆ VÀ TRẠNG THÁI ===");
  // Lấy system_code của hệ thống hiện tại
  console.log("Mã phân hệ kho hiện tại trên UI có thể là gì?");
  console.log("Hãy xem các system_code của các lot trên.");
}

main();
