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
  console.log("Tìm kiếm một lot_id bất kỳ gắn với vị trí...");
  const { data: positions, error: posError } = await supabase
    .from('positions')
    .select('id, code, lot_id')
    .not('lot_id', 'is', null)
    .limit(5);

  if (posError) {
    console.error("Lỗi truy vấn positions:", posError);
    return;
  }

  if (!positions || positions.length === 0) {
    console.log("Không tìm thấy lot_id nào được gán trên map.");
    // Thử tìm bất kỳ lot nào trong bảng lots
    const { data: lots, error: lotFindError } = await supabase
      .from('lots')
      .select('id, code')
      .limit(5);
    
    if (lotFindError) {
      console.error("Lỗi tìm lot:", lotFindError);
      return;
    }
    
    if (!lots || lots.length === 0) {
      console.log("Không có lot nào trong database.");
      return;
    }
    
    console.log("Tìm thấy lot ngẫu nhiên để test:", lots);
    await testDelete(lots[0].id, lots[0].code);
  } else {
    console.log("Tìm thấy positions có lot:", positions);
    const target = positions[0];
    await testDelete(target.lot_id, `Lot từ vị trí ${target.code}`);
  }
}

async function testDelete(lotId, label) {
  console.log(`\n--- Bắt đầu test xóa lot: ${label} (ID: ${lotId}) ---`);

  // 1. Thử cập nhật positions để gán lot_id = null
  console.log("1. Thử clear lot_id trong positions...");
  const { data: posUpdate, error: posUpError } = await supabase
    .from('positions')
    .update({ lot_id: null })
    .eq('lot_id', lotId);
  
  if (posUpError) {
    console.error("Lỗi clear lot_id trong positions:", JSON.stringify(posUpError, null, 2));
  } else {
    console.log("Clear positions thành công.");
  }

  // 2. Thử xóa lot_tags
  console.log("2. Thử xóa lot_tags...");
  const { data: tagsDel, error: tagsDelError } = await supabase
    .from('lot_tags')
    .delete()
    .eq('lot_id', lotId);

  if (tagsDelError) {
    console.error("Lỗi xóa lot_tags:", JSON.stringify(tagsDelError, null, 2));
  } else {
    console.log("Xóa lot_tags thành công.");
  }

  // 3. Thử xóa lot_items
  console.log("3. Thử xóa lot_items...");
  const { data: itemsDel, error: itemsDelError } = await supabase
    .from('lot_items')
    .delete()
    .eq('lot_id', lotId);

  if (itemsDelError) {
    console.error("Lỗi xóa lot_items:", JSON.stringify(itemsDelError, null, 2));
  } else {
    console.log("Xóa lot_items thành công.");
  }

  // 4. Thử xóa lots
  console.log("4. Thử xóa lots...");
  const { data: lotDel, error: lotDelError } = await supabase
    .from('lots')
    .delete()
    .eq('id', lotId);

  if (lotDelError) {
    console.error("Lỗi xóa lots thực sự:", JSON.stringify(lotDelError, null, 2));
  } else {
    console.log("Xóa lots thành công!");
  }
}

main();
