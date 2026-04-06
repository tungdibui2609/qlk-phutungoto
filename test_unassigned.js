const { createClient } = require('@supabase/supabase-js');

// We need to parse .env.local to get supabase keys
const fs = require('fs');
const env = fs.readFileSync('d:\\chanh thu\\web\\.env.local', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

if (!urlMatch || !keyMatch) {
  console.log("No env");
  process.exit(1);
}

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function test() {
  const systemCode = 'tungdibui2609/qlk-phutungoto';

  // 1. Count via RPC
  const { data: rpcData, count: rpcCount, error: rpcErr } = await supabase.rpc('get_unassigned_lots', { p_system_code: systemCode })
    .select('id', { count: 'exact' });

  console.log("RPC Count:", rpcCount, rpcErr?.message);

  // 2. Count via .is('positions', null)
  const { data: qData, count: qCount, error: qErr } = await supabase.from('lots')
    .select('id, positions!positions_lot_id_fkey(id)', { count: 'exact' })
    .eq('system_code', systemCode)
    .is('positions', null)
    .neq('status', 'hidden')
    .neq('status', 'exported');

  console.log("Query Count:", qCount, qErr?.message);

  // 3. Check if any lots have positions with lot_id matches
  if (rpcData && qData) {
      console.log("RPC Data Length:", rpcData.length);
      console.log("Query Data Length:", qData.length);
      const rpcIds = rpcData.map(d => d.id).sort();
      const qIds = qData.map(d => d.id).sort();
      let diff = rpcIds.filter(x => !qIds.includes(x));
      console.log("In RPC not in Query:", diff.length);
      diff = qIds.filter(x => !rpcIds.includes(x));
      console.log("In Query not in RPC:", diff.length);
  }
}

test();
