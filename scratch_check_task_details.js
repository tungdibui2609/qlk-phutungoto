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
  console.log("------------------- TRUY VẤN TASK DETAILS -------------------");
  const { data: task, error: taskErr } = await supabase
    .from('export_tasks')
    .select('*')
    .eq('id', taskId)
    .single();
  if (taskErr) {
    console.error("Task Error:", taskErr);
    return;
  }
  console.log("Task:", JSON.stringify(task, null, 2));

  console.log("------------------- TRUY VẤN TASK ITEMS -------------------");
  const { data: items, error: itemsErr } = await supabase
    .from('export_task_items')
    .select(`
      id,
      quantity,
      unit,
      status,
      position_id,
      positions!export_task_items_position_id_fkey (code),
      lots (
        id,
        code,
        positions!positions_lot_id_fkey (
          id,
          code
        )
      ),
      products (name, sku)
    `)
    .eq('task_id', taskId);

  if (itemsErr) {
    console.error("Items Error:", itemsErr);
    return;
  }
  console.log("Task Items count:", items.length);
  items.forEach((item, index) => {
    console.log(`\n--- Item ${index + 1} ---`);
    console.log(`Product: ${item.products?.name} (${item.products?.sku})`);
    console.log(`Quantity: ${item.quantity} ${item.unit}`);
    console.log(`Original Position ID/Code: ${item.position_id} / ${item.positions?.code}`);
    console.log(`Lot Code: ${item.lots?.code}`);
    console.log(`Lot Positions:`, JSON.stringify(item.lots?.positions, null, 2));
  });
}

main();
