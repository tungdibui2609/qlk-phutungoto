
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchTasks() {
    console.log('Fetching tasks with simpler query...');

    // Test 1: Just select *
    const { data: data1, error: error1 } = await supabase
        .from('export_tasks')
        .select('*')
        .limit(1);

    if (error1) {
        console.error('Error fetching *:', JSON.stringify(error1, null, 2));
    } else {
        console.log('Fetch * success. Columns:', data1.length > 0 ? Object.keys(data1[0]) : 'No data');
    }

    // Test 2: Select with items relation
    const { data: data2, error: error2 } = await supabase
        .from('export_tasks')
        .select('*, export_task_items(count)')
        .limit(1);

    if (error2) {
        console.error('Error fetching export_task_items relation:', JSON.stringify(error2, null, 2));
    } else {
        console.log('Fetch items relation success.');
    }

    // Test 3: Select with created_by relation explicit table name
    // Maybe try 'user_profiles!created_by(full_name)' or just 'user_profiles(full_name)'
    console.log('Testing user_profiles relation...');
    const { data: data3, error: error3 } = await supabase
        .from('export_tasks')
        .select('*, user_profiles(full_name)')
        .limit(1);

    if (error3) {
        console.error('Error fetching user_profiles relation:', JSON.stringify(error3, null, 2));
    } else {
        console.log('Fetch user_profiles relation success.');
    }
}

fetchTasks();
