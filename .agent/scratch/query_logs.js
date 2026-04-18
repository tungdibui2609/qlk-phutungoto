const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking audit_logs...");
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .in('action', ['DELETE'])
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error("Error checking audit logs:", error);
  } else {
    console.log("Audit Logs found:", data.filter(d => 
        (d.table_name === 'export_tasks' || d.table_name === 'export_task_items')
    ));
    
    // Let's print the last 10 deletes to be safe
    console.log("Last 10 deletes:", data.slice(0, 10));
  }
}

run();
