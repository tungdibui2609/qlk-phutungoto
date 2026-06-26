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
  console.log("=== THỐNG KÊ CÁC TRƯỜNG NGÀY TRONG BẢNG lots ===");
  const { data: lots, error } = await supabase
    .from('lots')
    .select('id, code, packaging_date, inbound_date, peeling_date, production_lot_id, created_at')
    .eq('status', 'active');

  if (error) {
    console.error("Lỗi:", error);
    return;
  }

  console.log("Tổng số lots hoạt động:", lots.length);

  let hasPkg = 0;
  let hasInbound = 0;
  let hasPeeling = 0;
  let hasProdLotId = 0;

  lots.forEach(l => {
    if (l.packaging_date) hasPkg++;
    if (l.inbound_date) hasInbound++;
    if (l.peeling_date) hasPeeling++;
    if (l.production_lot_id) hasProdLotId++;
  });

  console.log("Có packaging_date:", hasPkg);
  console.log("Có inbound_date:", hasInbound);
  console.log("Có peeling_date:", hasPeeling);
  console.log("Có production_lot_id:", hasProdLotId);

  // Thử lấy thêm dữ liệu production_lots để kiểm tra production_date
  const { data: prodLots } = await supabase
    .from('production_lots')
    .select('id, lot_code, production_date');
  
  console.log("Tổng số production_lots:", prodLots ? prodLots.length : 0);
  let hasProdDate = 0;
  const prodLotMap = {};
  if (prodLots) {
    prodLots.forEach(pl => {
      prodLotMap[pl.id] = pl;
      if (pl.production_date) hasProdDate++;
    });
  }
  console.log("Số production_lots có production_date:", hasProdDate);

  // Xem thử các lot có production_lot_id thì có production_date không
  let lotWithProdDate = 0;
  lots.forEach(l => {
    if (l.production_lot_id && prodLotMap[l.production_lot_id] && prodLotMap[l.production_lot_id].production_date) {
      lotWithProdDate++;
    }
  });
  console.log("Số lots hoạt động có production_date thông qua production_lot_id:", lotWithProdDate);
}

main();
