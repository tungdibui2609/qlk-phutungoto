import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://127.0.0.1:64321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

async function checkQueueRLS() {
  // Query pg_policies for stamp_scan_queue
  const { data: cols } = await supabase
    .from('stamp_scan_queue')
    .select('*')
    .limit(1);

  console.log('Sample row from stamp_scan_queue:', cols);

  // Check code inserting into stamp_scan_queue in pallet-box-scanner
}

checkQueueRLS();
