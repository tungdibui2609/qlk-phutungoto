import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'http://127.0.0.1:64321',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

async function findTung() {
  const { data: users } = await supabase
    .from('user_profiles')
    .select('*')
    .ilike('full_name', '%Tùng%');

  console.log('Tung profiles:', users);
}

findTung();
