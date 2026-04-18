const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function checkLot() {
  const { data } = await supabase.from('lots').select('code, quantity, status, lot_items(product_id, quantity)').ilike('code', '%355-45%');
  console.log("LOT 355-45 DB:", JSON.stringify(data, null, 2));

  const { data: itemData } = await supabase.from('export_task_items').select('id, lot_code, quantity, exported_quantity, status, metadata').ilike('lot_code', '%355-45%');
  console.log("EXPORT TASK ITEM DB:", JSON.stringify(itemData, null, 2));
}
checkLot();
