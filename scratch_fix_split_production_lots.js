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
  console.log("=== SỬA LỖI VÀ TÁCH LÔ SẢN XUẤT NGÀY HÔM NAY 30/05/2026 ===");

  const prodId = '4322e353-68e2-4a1a-95ba-772391e76d6b'; // LSX040426
  const productId = '33ea7af0-8404-469f-92b7-09639ed89198'; // Xoài Keaw cấp đông
  const companyId = 'b503014d-19b6-464e-91f3-f34eba4b4b05';

  // 1. Tạo Lô sản xuất mới cho ngày hôm nay: DL-LOT-300526-032
  console.log("Bước 1: Tạo Lô sản xuất mới DL-LOT-300526-032 trong database...");
  const { data: newPL, error: errCreate } = await supabase
    .from('production_lots')
    .insert({
      production_id: prodId,
      product_id: productId,
      lot_code: 'DL-LOT-300526-032',
      company_id: companyId,
      weight_per_unit: 10,
      planned_quantity: 60,
      print_config: {}
    })
    .select('*');

  if (errCreate) {
    console.error("Lỗi khi tạo Lô sản xuất mới:", errCreate);
    return;
  }

  const newPLId = newPL[0].id;
  console.log(`Đã tạo thành công Lô sản xuất mới! ID: ${newPLId}, mã: DL-LOT-300526-032`);

  // 2. Tìm tất cả các pallet in hôm nay (30/05/2026) của lệnh LSX040426
  console.log("\nBước 2: Tìm các pallet của ngày hôm nay...");
  const { data: todayLots, error: errLots } = await supabase
    .from('lots')
    .select('id, code, created_at')
    .eq('production_id', prodId)
    .ilike('code', 'DL-LOT-300526-%');

  if (errLots) {
    console.error("Lỗi khi truy vấn các pallet hôm nay:", errLots);
    return;
  }

  console.log(`Tìm thấy ${todayLots.length} pallet sản xuất ngày hôm nay:`, todayLots.map(l => l.code));

  if (todayLots.length > 0) {
    const lotIdsToUpdate = todayLots.map(l => l.id);
    
    // 3. Cập nhật production_lot_id của các pallet hôm nay sang ID mới
    console.log(`\nBước 3: Cập nhật production_lot_id sang ID mới (${newPLId}) cho ${todayLots.length} pallet...`);
    const { error: errUpdate } = await supabase
      .from('lots')
      .update({ production_lot_id: newPLId })
      .in('id', lotIdsToUpdate);

    if (errUpdate) {
      console.error("Lỗi khi cập nhật pallet:", errUpdate);
    } else {
      console.log("Đã cập nhật thành công liên kết Lô sản xuất mới cho các pallet ngày hôm nay!");
    }
  }

  // 4. Khôi phục lại bộ đếm in tem (last_printed_index) cho lô sản xuất mới từ số thứ tự thùng lớn nhất hôm nay
  console.log("\nBước 4: Cập nhật bộ đếm in tem cho lô mới...");
  const { data: maxBoxLot } = await supabase
    .from('lots')
    .select('metadata')
    .eq('production_lot_id', newPLId);

  let maxBox = 0;
  maxBoxLot?.forEach(l => {
    const boxNum = parseInt(l.metadata?.box_num_to || 0);
    if (boxNum > maxBox) maxBox = boxNum;
  });

  console.log(`Số thùng in lớn nhất hôm nay phát hiện được: ${maxBox}`);
  
  const { error: errCounter } = await supabase
    .from('production_lots')
    .update({
      last_printed_index: maxBox,
      total_printed_labels: maxBox
    })
    .eq('id', newPLId);

  if (errCounter) {
    console.error("Lỗi cập nhật bộ đếm:", errCounter);
  } else {
    console.log(`Đã cập nhật bộ đếm in tem thành công cho lô mới là: ${maxBox}`);
  }

  console.log("\n=== HOÀN THÀNH SỬA LỖI TÁCH LÔ ===");
}

main();
