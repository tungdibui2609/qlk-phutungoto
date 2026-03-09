
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testJoin() {
    console.log('Testing select products from lots...');
    const { data, error } = await supabase
        .from('lots')
        .select('id, products(name)')
        .limit(1);

    if (error) {
        console.error('ERROR products join:', error);
    } else {
        console.log('SUCCESS products join:', data);
    }

    console.log('Testing select lot_items(products(name)) from lots...');
    const { data: data2, error: error2 } = await supabase
        .from('lots')
        .select('id, lot_items(products(name))')
        .limit(1);

    if (error2) {
        console.error('ERROR items join:', error2);
    } else {
        console.log('SUCCESS items join:', data2);
    }
}

testJoin();
