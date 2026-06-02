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
  console.log("=== KHÔI PHỤC TOÀN DIỆN LIÊN KẾT LÔ SẢN XUẤT VÀ PALLET ===");

  // Bước 1: Lấy tất cả pallet thực tế có liên kết sản xuất (lots)
  const { data: lots, error: errLots } = await supabase
    .from('lots')
    .select('*, lot_items(*)')
    .not('production_id', 'is', null);

  if (errLots) {
    console.error("Lỗi lấy danh sách lots:", errLots);
    return;
  }

  console.log(`Tìm thấy ${lots.length} pallet kho thực tế có gắn mã Lệnh sản xuất.`);

  // Bước 2: Duyệt và nhóm theo (production_id, product_id)
  const groups = {};
  lots.forEach(lot => {
    const prodId = lot.production_id;
    const items = lot.lot_items || [];
    items.forEach(item => {
      const prodIdItemKey = `${prodId}_${item.product_id}`;
      if (!groups[prodIdItemKey]) {
        groups[prodIdItemKey] = {
          production_id: prodId,
          product_id: item.product_id,
          // Ưu tiên lấy mã pallet làm mã lô sản xuất mặc định
          lot_code: lot.code || lot.production_code || `LOT-SX-${lot.created_at.split('T')[0]}`,
          company_id: lot.company_id,
          lots: []
        };
      }
      groups[prodIdItemKey].lots.push(lot);
    });
  });

  console.log(`Phát hiện ${Object.keys(groups).length} nhóm (Lệnh sản xuất + Sản phẩm) cần cấu hình Lô sản xuất.`);

  // Bước 3: Đảm bảo mỗi nhóm đều có bản ghi trong production_lots
  for (const key of Object.keys(groups)) {
    const group = groups[key];
    
    // Kiểm tra xem đã có production_lots nào tương ứng chưa
    const { data: existing, error: errCheck } = await supabase
      .from('production_lots')
      .select('*')
      .eq('production_id', group.production_id)
      .eq('product_id', group.product_id);

    if (errCheck) {
      console.error(`Lỗi kiểm tra nhóm ${key}:`, errCheck);
      continue;
    }

    let productionLotId = null;

    if (existing && existing.length > 0) {
      // Đã có lô sản xuất
      productionLotId = existing[0].id;
      console.log(`Nhóm ${key} đã tồn tại Lô sản xuất ID: ${productionLotId}, mã: ${existing[0].lot_code}`);
      
      // Nếu là Lệnh LSX030526 mà đang mang mã lạ DL-LOT-110526-4104, ta có thể đổi tên nếu cần thiết
      // Nhưng trước mắt, ta sẽ nối lại liên kết cho các pallet
    } else {
      // Chưa có lô sản xuất (như trường hợp DL-LOT-200526-032 của lệnh LSX040426)
      console.log(`Nhóm ${key} chưa có Lô sản xuất. Đang tạo mới với mã gợi ý: ${group.lot_code}...`);
      
      const { data: newPL, error: errCreate } = await supabase
        .from('production_lots')
        .insert({
          production_id: group.production_id,
          product_id: group.product_id,
          lot_code: group.lot_code,
          company_id: group.company_id,
          weight_per_unit: 10, // Mặc định
          planned_quantity: 100, // Mặc định
          print_config: {}
        })
        .select('*');

      if (errCreate) {
        console.error(`Lỗi tạo Lô sản xuất cho nhóm ${key}:`, errCreate);
        continue;
      }

      productionLotId = newPL[0].id;
      console.log(`Đã tạo thành công Lô sản xuất mới! ID: ${productionLotId}, mã: ${group.lot_code}`);
    }

    // Bước 4: Cập nhật lại production_lot_id trong bảng lots cho tất cả các pallet thuộc nhóm này
    const lotIdsToUpdate = group.lots.map(l => l.id);
    console.log(`Cập nhật production_lot_id = ${productionLotId} cho các pallet:`, lotIdsToUpdate);

    const { error: errUpdateLots } = await supabase
      .from('lots')
      .update({ production_lot_id: productionLotId })
      .in('id', lotIdsToUpdate);

    if (errUpdateLots) {
      console.error(`Lỗi cập nhật lots cho nhóm ${key}:`, errUpdateLots);
    } else {
      console.log(`Đã cập nhật thành công liên kết cho nhóm ${key}.`);
    }
  }

  console.log("\n=== KHÔI PHỤC HOÀN TẤT ===");
}

main();
