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

async function searchTable(tableName, searchString) {
  // Lấy danh sách cột để tìm
  let columns = [];
  if (tableName === 'lots') {
    columns = ['code', 'production_code', 'batch_code', 'notes'];
  } else if (tableName === 'production_lots') {
    columns = ['lot_code'];
  } else if (tableName === 'productions') {
    columns = ['code', 'name', 'description'];
  } else if (tableName === 'products') {
    columns = ['sku', 'name'];
  } else if (tableName === 'fresh_material_batches') {
    columns = ['batch_code', 'notes'];
  } else {
    columns = [];
  }

  if (columns.length === 0) return;

  for (const col of columns) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .ilike(col, `%${searchString}%`);

    if (error) {
      console.error(`Lỗi khi tìm ở bảng ${tableName}, cột ${col}:`, error.message);
      continue;
    }

    if (data && data.length > 0) {
      console.log(`[Tìm thấy!] Bảng: ${tableName}, Cột: ${col}, Số bản ghi: ${data.length}`);
      data.forEach(row => {
        console.log("Chi tiết bản ghi:", {
          id: row.id,
          code: row.code || row.lot_code || row.batch_code || row.sku,
          name: row.name,
          production_id: row.production_id,
          created_at: row.created_at,
          metadata: row.metadata
        });
      });
    }
  }
}

async function main() {
  const searchValue = 'L036DD260-TN';
  console.log(`=== BẮT ĐẦU TÌM KIẾM GIÁ TRỊ: "${searchValue}" TRÊN TOÀN BỘ CƠ SỞ DỮ LIỆU ===`);

  const tables = [
    'lots',
    'production_lots',
    'productions',
    'products',
    'fresh_material_batches'
  ];

  for (const t of tables) {
    await searchTable(t, searchValue);
  }

  // Thử tìm kiếm lỏng hơn nữa (ví dụ: tìm substring L036DD)
  const shortSearch = 'L036DD';
  console.log(`\n=== TÌM KIẾM PHỤ (LỎNG HƠN): "${shortSearch}" ===`);
  for (const t of tables) {
    await searchTable(t, shortSearch);
  }

  console.log("=== KẾT THÚC TÌM KIẾM ===");
}

main();
