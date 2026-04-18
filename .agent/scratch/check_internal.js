const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=([^\r\n]+)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function checkInternal() {
  const { data: internal, error: e1 } = await supabase.from('internal_products').select('*').limit(2);
  const { data: mapping, error: e2 } = await supabase.from('product_mappings').select('*').limit(2);
  const { data: mapping2, error: e3 } = await supabase.from('internal_product_mappings').select('*').limit(2);
  
  console.log("internal_products", internal, e1);
  console.log("product_mappings", mapping, e2);
  console.log("internal_product_mappings", mapping2, e3);
}
checkInternal();
