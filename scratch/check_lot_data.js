
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLots() {
  const { data, error } = await supabase
    .from('lots')
    .select('id, code, production_code, batch_code, productions(code), products(sku)')
    .eq('status', 'active')
    .filter('products.sku', 'like', '%HH112010902.001.02%')
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  console.log('Lots found:', JSON.stringify(data, null, 2));
}

checkLots();
