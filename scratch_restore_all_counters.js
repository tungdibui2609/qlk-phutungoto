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
  console.log("=== KHÔI PHỤC TOÀN DIỆN BỘ ĐẾM IN TEM (last_printed_index) CHO TẤT CẢ CÁC LÔ SẢN XUẤT ===");

  // 1. Lấy tất cả các lô sản xuất trong bảng production_lots
  const { data: pLots, error: errPLots } = await supabase
    .from('production_lots')
    .select('id, lot_code, production_id, product_id, products(name)');

  if (errPLots) {
    console.error("Lỗi lấy danh sách production_lots:", errPLots);
    return;
  }

  console.log(`Tìm thấy ${pLots.length} Lô sản xuất trên hệ thống.`);

  for (const pl of pLots) {
    console.log(`\nĐang quét bộ đếm cho Lô: "${pl.lot_code}" (Sản phẩm: ${pl.products?.name || 'Chưa rõ'})...`);

    // 2. Tìm tất cả pallet thực tế liên kết với lô này
    const { data: lots, error: errLots } = await supabase
      .from('lots')
      .select('id, code, daily_seq')
      .eq('production_lot_id', pl.id)
      .not('daily_seq', 'is', null);

    if (errLots) {
      console.error(`  Lỗi khi lấy pallet của lô ${pl.lot_code}:`, errLots);
      continue;
    }

    console.log(`  Tìm thấy ${lots.length} pallet thực tế đã in.`);

    if (lots.length === 0) {
      console.log(`  Chưa có pallet nào được in. Giữ nguyên bộ đếm = 0.`);
      continue;
    }

    // 3. Tìm daily_seq lớn nhất
    let maxSeqNum = 0;
    lots.forEach(l => {
      const num = Number(l.daily_seq);
      if (!isNaN(num)) {
        // Giải mã lấy số thứ tự thực tế (seq = daily_seq % 100000)
        // Ví dụ: daily_seq = 100078 (A78) -> seq = 78
        const seq = num % 100000;
        if (seq > maxSeqNum) {
          maxSeqNum = seq;
        }
      }
    });

    console.log(`  Số thứ tự in tem lớn nhất phát hiện được trong kho của lô này: ${maxSeqNum}`);

    // 4. Cập nhật lại bộ đếm in tem trong bảng production_lots
    const { error: errUpdate } = await supabase
      .from('production_lots')
      .update({
        last_printed_index: maxSeqNum,
        total_printed_labels: maxSeqNum
      })
      .eq('id', pl.id);

    if (errUpdate) {
      console.error(`  Lỗi khi cập nhật bộ đếm cho lô ${pl.lot_code}:`, errUpdate.message);
    } else {
      console.log(`  Khôi phục thành công bộ đếm in tem của lô ${pl.lot_code} lên số: ${maxSeqNum}`);
    }
  }

  console.log("\n=== KHÔI PHỤC TOÀN DIỆN BỘ ĐẾM HOÀN TẤT ===");
}

main();
