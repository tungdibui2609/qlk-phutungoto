const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPermissions() {
  const { data, error } = await supabase
    .from('permissions')
    .select('code, name, module')
    .ilike('code', '%lot%');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Permissions found:');
  console.table(data);
}

checkPermissions();
