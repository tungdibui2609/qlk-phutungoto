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
  console.log("=== CHECKING SYSTEM TYPES AND COMPANIES ===");

  // 1. Check companies
  const { data: companies } = await supabase.from('companies').select('id, code, name');
  console.log("Companies:", JSON.stringify(companies, null, 2));

  // 2. Check counts of zones by system_type and company_id
  const { data: zoneCounts, error: zErr } = await supabase
    .from('zones')
    .select('system_type, company_id, id')
    .then(({ data }) => {
      const counts = {};
      (data || []).forEach(z => {
        const key = `${z.system_type} | ${z.company_id}`;
        counts[key] = (counts[key] || 0) + 1;
      });
      return { data: counts };
    });
  
  console.log("Zone counts by (system_type | company_id):", zoneCounts);

  // 3. Check counts of positions by system_type and company_id
  const { data: posCounts } = await supabase
    .from('positions')
    .select('system_type, company_id')
    .then(({ data }) => {
      const counts = {};
      (data || []).forEach(p => {
        const key = `${p.system_type} | ${p.company_id}`;
        counts[key] = (counts[key] || 0) + 1;
      });
      return { data: counts };
    });

  console.log("Position counts by (system_type | company_id):", posCounts);
}

main();
