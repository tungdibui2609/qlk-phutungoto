const { createClient } = require('@supabase/supabase-js');

const fs = require('fs');
const env = fs.readFileSync('d:\\chanh thu\\web\\.env.local', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function test() {
  const systemCode = 'tungdibui2609/qlk-phutungoto';

  // Passing count in .select()
  const res1 = await supabase.rpc('get_unassigned_lots', { p_system_code: systemCode })
    .select('id', { count: 'exact' });

  console.log("RPC Count via select():", res1.count);

  // Passing count in rpc() options
  const res2 = await supabase.rpc('get_unassigned_lots', { p_system_code: systemCode }, { count: 'exact' })
    .select('id');

  console.log("RPC Count via rpc():", res2.count);
}

test();
