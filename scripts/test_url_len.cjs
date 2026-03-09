
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTIwNzIsImV4cCI6MjA4Mzg4ODA3Mn0.B7OHjrpO5ibcS4_wmGics2rLWKz89_3apGEWJlg2-aE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLargeOr() {
    const ids = Array.from({ length: 300 }, () => '550e8400-e29b-41d4-a716-446655440000');
    console.log(`Testing OR filter with ${ids.length} IDs...`);

    // Construct or string
    const orStr = `id.in.(${ids.join(',')})`;

    const { data, error } = await supabase
        .from('lots')
        .select('id')
        .or(orStr)
        .limit(1);

    if (error) {
        console.error('ERROR Large OR:', error);
    } else {
        console.log('SUCCESS Large OR');
    }
}

testLargeOr();
