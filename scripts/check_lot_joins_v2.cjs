
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testJoin() {
    console.log('Testing select products (plural) from lots...');
    const { error: error1 } = await supabase.from('lots').select('id, products(name)').limit(1);
    if (error1) console.error('ERROR products:', error1.message);
    else console.log('SUCCESS products');

    console.log('Testing select product (singular) from lots...');
    const { error: error2 } = await supabase.from('lots').select('id, product(name)').limit(1);
    if (error2) console.error('ERROR product:', error2.message);
    else console.log('SUCCESS product');
}

testJoin();
