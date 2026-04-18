const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function checkLot() {
  const { data } = await supabase.from('lots').select('quantity, status, lot_items(product_id, quantity)').eq('code', 'LOT-301650-355-45').single();
  console.log("LOT 355-45 DB:", JSON.stringify(data, null, 2));

  const { data: itemData } = await supabase.from('export_task_items').select('id, quantity, exported_quantity, status, metadata').eq('lot_code', 'LOT-301650-355-45');
  console.log("EXPORT TASK ITEM DB:", JSON.stringify(itemData, null, 2));
}
checkLot();
