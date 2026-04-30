const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // If this RPC exists
  if (error) {
    console.log('RPC get_tables failed, trying direct select on information_schema...');
    const { data: tables, error: err } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
    if (err) {
      console.error('Direct select failed:', err);
    } else {
      console.log('Tables:', tables.map(t => t.table_name));
    }
  } else {
    console.log('Tables:', data);
  }
}

listTables();
