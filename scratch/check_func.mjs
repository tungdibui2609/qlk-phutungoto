import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://127.0.0.1:64321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

async function checkFunc() {
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id, email, company_id')
    .eq('email', 'tungnd2609@gmail.com')
    .single();

  console.log('User profile for tungnd2609@gmail.com:', userProfile);

  // Check policies on stamp_scan_queue
  const { data: pols } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'stamp_scan_queue');
  console.log('Policies on stamp_scan_queue:', pols);
}

checkFunc();
