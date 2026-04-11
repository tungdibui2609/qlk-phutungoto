
const { createClient } = require('@supabase/supabase-client');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('productions')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching productions:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Columns in productions:', Object.keys(data[0]));
  } else {
    // If table is empty, we can try to get column info from rpc if available, 
    // or just assume it might be empty. But usually it has data.
    console.log('Productions table is empty.');
    
    // Attempt to insert a dummy to see if it fails on missing column
    const { error: insertError } = await supabase
        .from('productions')
        .select('last_sheet_index')
        .limit(1);
    
    if (insertError) {
        console.log('Error selecting last_sheet_index:', insertError.message);
    } else {
        console.log('last_sheet_index exists.');
    }
  }
}

checkColumns();
