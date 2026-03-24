const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function countAll() {
  const { count: uCount } = await supabase.from('units').select('*', { count: 'exact', head: true });
  const { count: puCount } = await supabase.from('product_units').select('*', { count: 'exact', head: true });
  const { count: pCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
  
  console.log(`Total Units: ${uCount}`);
  console.log(`Total Product Units: ${puCount}`);
  console.log(`Total Products: ${pCount}`);
}

countAll();
