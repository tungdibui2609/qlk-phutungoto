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
  const code = 'DL-LOT-290626-200281';
  console.log(`=== KIỂM TRA LOT: ${code} ===`);

  // 1. Lấy thông tin lot trong bảng 'lots' và 'positions'
  const { data: lots, error: lotErr } = await supabase
    .from('lots')
    .select('*, positions!positions_lot_id_fkey(*)')
    .eq('code', code);

  if (lotErr) {
    console.error("Lỗi select lots:", lotErr);
    return;
  }

  console.log("Kết quả select lots:", JSON.stringify(lots, null, 2));

  if (!lots || lots.length === 0) {
    console.log("Không tìm thấy lot với code này.");
    return;
  }

  const lot = lots[0];

  // 2. Kiểm tra trực tiếp bảng positions xem có bản ghi nào liên kết với lot.id hay không
  const { data: positions, error: posErr } = await supabase
    .from('positions')
    .select('*')
    .eq('lot_id', lot.id);

  if (posErr) {
    console.error("Lỗi select positions:", posErr);
  } else {
    console.log("Các vị trí liên kết với lot.id trong bảng positions:", JSON.stringify(positions, null, 2));
  }

  // 3. Gọi RPC 'get_unassigned_lots' xem lot này có trả về không
  const { data: unassignedLots, error: rpcErr } = await supabase
    .rpc('get_unassigned_lots', { p_system_code: lot.system_code });

  if (rpcErr) {
    console.error("Lỗi gọi RPC get_unassigned_lots:", rpcErr);
  } else {
    const isFound = unassignedLots.some(l => l.id === lot.id);
    console.log(`RPC get_unassigned_lots trả về tổng cộng ${unassignedLots.length} lots.`);
    console.log(`Lot ${code} có nằm trong kết quả của RPC get_unassigned_lots không?`, isFound ? "CÓ" : "KHÔNG");
  }
}

main();
