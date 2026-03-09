
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testJoin() {
    const lotCode = 'DL-LOT-090326-024';
    console.log(`Testing join for Lot: ${lotCode}`);

    const { data, error } = await supabase
        .from('lots')
        .select(`
        id,
        code,
        lot_tags (
            tag
        )
    `)
        .eq('code', lotCode)
        .single();

    if (error) {
        console.error("Error:", error.message);
    } else {
        console.log("Result:", JSON.stringify(data, null, 2));
    }
}

testJoin();
