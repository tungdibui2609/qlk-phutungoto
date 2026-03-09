
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testPropertyName() {
    console.log('Testing select lots!positions_lot_id_fkey(id) from ANY position...');
    const { data, error } = await supabase
        .from('positions')
        .select('id, lots!positions_lot_id_fkey(id)')
        .limit(1);

    if (error) {
        console.error('ERROR:', error);
    } else if (data && data.length > 0) {
        console.log('Result item keys:', Object.keys(data[0]));
        console.log('Result item data:', JSON.stringify(data[0], null, 2));
    } else {
        console.log('No positions found.');
    }
}

testPropertyName();
