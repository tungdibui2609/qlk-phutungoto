const { createClient } = require('@supabase/supabase-client');

// Extract config from .env or lib/supabaseClient (giả định)
const supabaseUrl = 'YOUR_SUPABASE_URL'; 
const supabaseKey = 'YOUR_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExports() {
    const { data, error } = await supabase
        .from('lots')
        .select('id, code, status, metadata')
        .eq('status', 'exported')
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('--- 5 LOTs đã xuất gần nhất ---');
    data.forEach(lot => {
        console.log(`LOT: ${lot.code} | Status: ${lot.status}`);
        console.log(`Metadata exports:`, lot.metadata?.system_history?.exports || 'Trống');
    });
}

// Chạy thử
// checkExports();
