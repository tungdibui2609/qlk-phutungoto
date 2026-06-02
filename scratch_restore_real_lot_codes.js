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
  console.log("=== KHÔI PHỤC TOÀN DIỆN MÃ LOT SẢN XUẤT BAN ĐẦU CỦA NGƯỜI DÙNG ===");

  // 1. Lấy tất cả pallet thực tế có production_code và production_lot_id trong bảng lots
  const { data: lots, error: errLots } = await supabase
    .from('lots')
    .select('id, code, production_code, production_lot_id')
    .not('production_code', 'is', null)
    .not('production_lot_id', 'is', null);

  if (errLots) {
    console.error("Lỗi lấy danh sách lots:", errLots);
    return;
  }

  console.log(`Tìm thấy ${lots.length} pallet thực tế có lưu trữ mã sản xuất thực tế ban đầu (production_code).`);

  // 2. Tạo bản đồ ánh xạ từ production_lot_id sang production_code thực tế
  const plMap = {};
  lots.forEach(l => {
    const plId = l.production_lot_id;
    const realCode = l.production_code;
    
    // Nếu có nhiều pallet cùng thuộc một lô sản xuất (production_lot_id), ta lấy mã không rỗng
    if (realCode && realCode.trim()) {
      plMap[plId] = realCode.trim().toUpperCase();
    }
  });

  console.log("Bản đồ khôi phục Lô sản xuất phát hiện được:", plMap);

  // 3. Tiến hành cập nhật lại mã lot_code thực sự cho từng production_lots
  const plIds = Object.keys(plMap);
  if (plIds.length === 0) {
    console.log("Không phát hiện mối liên kết mã sản xuất nào cần khôi phục.");
    return;
  }

  console.log(`\nBắt đầu cập nhật lại mã LOT sản xuất thực sự cho ${plIds.length} lô...`);
  
  for (const plId of plIds) {
    const realLotCode = plMap[plId];
    
    // Lấy thông tin lô cũ để in log so sánh
    const { data: oldPL } = await supabase
      .from('production_lots')
      .select('lot_code')
      .eq('id', plId)
      .maybeSingle();

    const oldCode = oldPL ? oldPL.lot_code : 'Không rõ';

    if (oldCode.toUpperCase() === realLotCode.toUpperCase()) {
      console.log(`- Lô ID ${plId} đã mang mã chính xác: ${realLotCode} (Bỏ qua)`);
      continue;
    }

    console.log(`- Đang khôi phục Lô ID ${plId}: [Mã sai: ${oldCode}] -> [MÃ ĐÚNG: ${realLotCode}]`);

    const { error: errUpdate } = await supabase
      .from('production_lots')
      .update({ lot_code: realLotCode })
      .eq('id', plId);

    if (errUpdate) {
      console.error(`  Lỗi khi cập nhật Lô ${plId}:`, errUpdate.message);
    } else {
      console.log(`  Đã khôi phục thành công!`);
    }
  }

  console.log("\n=== KHÔI PHỤC TOÀN DIỆN HOÀN TẤT ===");
}

main();
