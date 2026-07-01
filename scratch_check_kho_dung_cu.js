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
  console.log("=== CHECKING KHO_DUNG_CU ===");

  // Check lots in KHO_DUNG_CU
  const { data: lots } = await supabase
    .from('lots')
    .select('company_id, system_code')
    .eq('system_code', 'KHO_DUNG_CU')
    .limit(10);
  
  console.log("Lots in KHO_DUNG_CU:", lots);

  // Check zones in KHO_DUNG_CU
  const { data: zones } = await supabase
    .from('zones')
    .select('company_id, system_type')
    .eq('system_type', 'KHO_DUNG_CU')
    .limit(10);
  
  console.log("Zones in KHO_DUNG_CU:", zones);
}

main();
