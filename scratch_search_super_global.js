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
  const searchValue = 'L036DD260-TN';
  console.log(`=== BẮT ĐẦU TÌM KIẾM TOÀN DÂN: "${searchValue}" ===`);

  // Thử tìm trong tất cả các bảng thông dụng
  const tables = [
    'lots',
    'lot_items',
    'production_lots',
    'productions',
    'production_inputs',
    'fresh_material_batches',
    'fresh_material_stages',
    'fresh_material_stage_outputs',
    'delivery_settings',
    'operational_notes',
    'products',
    'qc_info'
  ];

  for (const table of tables) {
    // Lấy 1 bản ghi để lấy danh sách các cột
    const { data: sample, error: errSample } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (errSample || !sample || sample.length === 0) continue;

    const columns = Object.keys(sample[0]);
    for (const col of columns) {
      // Chỉ tìm các cột dạng string (bỏ qua id, created_at, v.v. nếu là uuid hoặc date)
      if (col === 'id' || col.endsWith('_id') || col.endsWith('_at') || col === 'created_at' || col === 'updated_at') continue;

      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .ilike(col, `%${searchValue}%`);

        if (error) continue;

        if (data && data.length > 0) {
          console.log(`[Khớp!] Bảng: ${table}, Cột: ${col}`);
          console.log(JSON.stringify(data, null, 2));
        }
      } catch (e) {
        // Bỏ qua cột không hỗ trợ ilike (ví dụ boolean hoặc jsonb)
      }
    }
  }

  // Thử tìm kiếm lỏng hơn một chút: 'L036DD' hoặc '260-TN'
  const partialValue = '260-TN';
  console.log(`\n=== TÌM KIẾM PHẦN TỬ LỎNG HƠN: "${partialValue}" ===`);
  for (const table of tables) {
    const { data: sample } = await supabase.from(table).select('*').limit(1);
    if (!sample || sample.length === 0) continue;
    const columns = Object.keys(sample[0]);
    for (const col of columns) {
      if (col === 'id' || col.endsWith('_id') || col.endsWith('_at') || col === 'created_at' || col === 'updated_at') continue;
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .ilike(col, `%${partialValue}%`);

        if (error) continue;
        if (data && data.length > 0) {
          console.log(`[Khớp lỏng!] Bảng: ${table}, Cột: ${col}`);
          console.log(JSON.stringify(data, null, 2));
        }
      } catch (e) {}
    }
  }

  console.log("=== KẾT THÚC TÌM KIẾM TOÀN DÂN ===");
}

main();
