const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  console.log("Fixing corrupted statuses...");
  
  // Lấy toàn bộ các export_task_items có exported >= quantity nhưng chưa Exported
  const { data: items } = await supabase.from('export_task_items').select('*')
     .neq('status', 'Exported');
     
  if (!items) return console.log("Không có items");

  let c = 0;
  for (let it of items) {
      const exported = it.exported_quantity || 0;
      if (exported >= it.quantity - 0.000001) {
          console.log(`Fixing item id=${it.id}, quantity=${it.quantity}, exported=${exported}`);
          await supabase.from('export_task_items').update({ status: 'Exported' }).eq('id', it.id);
          c++;
      }
  }
  console.log("Fixed " + c + " items.");
}
run();
