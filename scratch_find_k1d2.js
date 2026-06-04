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
  const taskId = '7402956f-6df1-44a3-8d0b-83a23880318c';
  const { data: items, error } = await supabase
    .from('export_task_items')
    .select(`
      id,
      lots (
        id,
        code,
        positions!positions_lot_id_fkey (
          id,
          code
        )
      ),
      positions!export_task_items_position_id_fkey (
        id,
        code
      )
    `)
    .eq('task_id', taskId);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Tìm kiếm K1D2B12T401:");
  let found = false;
  items.forEach((item, index) => {
    const curCode = item.lots?.positions?.[0]?.code || 'N/A';
    const origCode = item.positions?.code || 'N/A';
    if (curCode.includes('K1D2B12T401') || origCode.includes('K1D2B12T401')) {
      found = true;
      console.log(`Item #${index + 1}:`);
      console.log(`  Lot Code: ${item.lots?.code}`);
      console.log(`  Original Position: ${origCode}`);
      console.log(`  Current Position: ${curCode}`);
    }
  });

  if (!found) {
    console.log("Không tìm thấy item nào liên quan đến K1D2B12T401 trong task items.");
  }
}

main();
