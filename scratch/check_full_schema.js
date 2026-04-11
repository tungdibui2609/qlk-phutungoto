
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('--- Checking production_lots columns ---');
  const { data: lotData, error: lotError } = await supabase
    .from('production_lots')
    .select('*')
    .limit(1);
    
  if (lotError) {
    console.error('Error selecting from production_lots:', lotError.message);
  } else if (lotData && lotData.length > 0) {
    console.log('Production_lots columns:', Object.keys(lotData[0]));
  } else {
    console.log('Production_lots is empty.');
  }

  console.log('\n--- Checking productions columns ---');
  const { data: prodData, error: prodError } = await supabase
    .from('productions')
    .select('*')
    .limit(1);
    
  if (prodError) {
    console.error('Error selecting from productions:', prodError.message);
  } else if (prodData && prodData.length > 0) {
    console.log('Productions columns:', Object.keys(prodData[0]));
  } else {
    console.log('Productions is empty.');
  }

  // Testing specific missing columns mentioned in code
  const columnsToTest = {
    production_lots: [
      'product_id', 
      'last_printed_index', 
      'total_printed_labels', 
      'total_printed_sheets', 
      'damaged_printed_labels', 
      'damaged_printed_sheets', 
      'damaged_print_logs', 
      'last_printed_at', 
      'print_config'
    ],
    productions: [
      'last_sheet_index'
    ]
  };

  for (const [table, columns] of Object.entries(columnsToTest)) {
    console.log(`\nTesting ${table} for specific columns:`);
    for (const col of columns) {
      const { error } = await supabase.from(table).select(col).limit(1);
      if (error) {
        console.log(`[MISSING] ${col}: ${error.message}`);
      } else {
        console.log(`[EXISTS] ${col}`);
      }
    }
  }
}

checkSchema();
