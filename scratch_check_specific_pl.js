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
  const plId = '8b5e4eb6-47da-4f95-8d8b-84b2ecd499b3';
  console.log("=== KIỂM TRA BẢN GHI PRODUCTION_LOTS CỦA PALLET L015DD260-TN ===");
  const { data: pl, error } = await supabase
    .from('production_lots')
    .select('*, products(name), productions(code, name)')
    .eq('id', plId);

  console.log("Production Lot trong DB:", JSON.stringify(pl, null, 2));
}

main();
