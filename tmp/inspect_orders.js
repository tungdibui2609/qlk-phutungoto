const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectSchema() {
  console.log('--- INSPECTING INBOUND_ORDERS TABLE ---');
  const { data, error } = await supabase
    .from('inbound_orders')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('Sample Row:', data[0]);
  } else {
    console.log('No data found in inbound_orders');
  }

  console.log('--- INSPECTING OUTBOUND_ORDERS TABLE ---');
  const { data: outData, error: outError } = await supabase
    .from('outbound_orders')
    .select('*')
    .limit(1);
    
  if (outError) {
    console.error('Error:', outError);
  } else if (outData && outData.length > 0) {
    console.log('Columns:', Object.keys(outData[0]));
    // console.log('Sample Row:', outData[0]);
  } else {
    console.log('No data found in outbound_orders');
  }
}

inspectSchema();
