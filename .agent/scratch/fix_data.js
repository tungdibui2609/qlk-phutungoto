const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  console.log("Fixing over-exported data...");
  const lotCode = 'LOT-462397-508-5';
  
  // 1. Tìm Lot này
  const { data: lotData } = await supabase.from('lots').select('*, lot_items(*)').eq('code', lotCode).single();
  if (!lotData) process.exit(1);

  console.log("Current Lot Quantity:", lotData.quantity);
  
  // 2. Tìm export_task_item bị lạm
  const { data: etiData } = await supabase.from('export_task_items').select('*').eq('lot_code', lotCode).order('exported_quantity', { ascending: false }).limit(1);
  if (!etiData || etiData.length === 0) process.exit(1);

  const item = etiData[0];
  console.log("Export Task Item Quantity Required:", item.quantity, " | Exported:", item.exported_quantity);

  // Nếu bị lạm (VD 74 > 60), ta sẽ sửa lại đúng bằng số lượng giới hạn của item đó.
  if (item.exported_quantity > item.quantity) {
     const overAmount = item.exported_quantity - item.quantity; // 74 - 60 = 14
     
     // Trả lại tồn kho lô
     const lotNewQty = lotData.quantity + overAmount;
     await supabase.from('lots').update({ quantity: lotNewQty }).eq('id', lotData.id);
     
     // Cập nhật lại số lượng đã xuất
     await supabase.from('export_task_items').update({ 
         exported_quantity: item.quantity,
         status: 'Exported'
     }).eq('id', item.id);
     
     console.log("Fixed! Refunded", overAmount, "back to lot and set exported back to", item.quantity);
  } else {
     console.log("No need to fix.");
  }
}
run();
