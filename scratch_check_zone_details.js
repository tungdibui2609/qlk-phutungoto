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
  const zoneId = '8f06444e-6a14-47f6-954c-4dbba24f5bfa'; // TẦNG 4
  console.log(`=== KIỂM TRA NHÁNH ZONE: ${zoneId} ===`);

  let currentId = zoneId;
  while (currentId) {
    const { data: zone, error } = await supabase
      .from('zones')
      .select('*')
      .eq('id', currentId)
      .single();

    if (error) {
      console.error(`Lỗi select zone ${currentId}:`, error);
      break;
    }

    console.log(`Zone ID: ${zone.id} | Code: ${zone.code} | Name: ${zone.name} | Level: ${zone.level} | company_id: ${zone.company_id} | parent_id: ${zone.parent_id}`);
    currentId = zone.parent_id;
  }
}

main();
