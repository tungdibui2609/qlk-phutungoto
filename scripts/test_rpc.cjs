
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRPC() {
    console.log('Testing RPC get_unassigned_lots...');
    // Try to get system code from a system if any
    const { data: systems } = await supabase.from('systems').select('code').limit(1);
    const systemCode = systems && systems.length > 0 ? systems[0].code : 'oto';

    console.log(`Using system code: ${systemCode}`);
    const { data, error, count } = await supabase.rpc('get_unassigned_lots', { p_system_code: systemCode })
        .select('*', { count: 'exact' })
        .range(0, 10);

    if (error) {
        console.error('ERROR RPC:', error);
    } else {
        console.log('SUCCESS RPC: Items count:', data ? data.length : 0, 'Total count:', count);
    }
}

testRPC();
