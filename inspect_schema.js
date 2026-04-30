const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchema(table) {
  console.log(`--- INSPECTING ${table.toUpperCase()} TABLE ---`);
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error:', error);
  } else if (!data || data.length === 0) {
    console.log('No data found in table.');
  } else {
    console.log('Columns:', Object.keys(data[0]));
    console.log('Sample Row:', data[0]);
  }
}

async function run() {
  await inspectSchema('lots');
  await inspectSchema('production_lots');
}

run();
