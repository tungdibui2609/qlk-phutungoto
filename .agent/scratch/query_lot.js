const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Đọc đường dẫn tương đối tới .env.local
const envPath = path.join(process.cwd(), '.env.local');
let envFile = '';
try {
  envFile = fs.readFileSync(envPath, 'utf8');
} catch (e) {
  console.log("Failed to load .env.local");
  process.exit(1);
}

const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/);

if (!urlMatch || !keyMatch) {
  console.log("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data: lotData, error: lotErr } = await supabase
    .from('lots')
    .select('*, lot_items(*, products(sku))')
    .eq('code', 'LOT-462397-508-5')
    .single();

  if (lotErr) {
    console.error("Error fetching lot:", lotErr);
  } else {
    console.log("=== LOT ITEMS INFO ===");
    console.log(JSON.stringify(lotData.lot_items, null, 2));
  }

  const { data: taskItems, error: qErr } = await supabase
    .from('export_task_items')
    .select('*, products(sku)')
    .eq('lot_code', 'LOT-462397-508-5');

  if (qErr) {
    console.error("Error fetching export task items:", qErr);
  } else {
    console.log("\n=== EXPORT TASK ITEMS INFO ===");
    taskItems.forEach(item => {
      if (item.products.sku === 'HH112010902.003.01') {
        console.log(JSON.stringify(item, null, 2));
      }
    });
  }
}
run();
