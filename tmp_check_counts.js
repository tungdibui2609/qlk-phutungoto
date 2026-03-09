
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
    const { count: lotCount } = await supabase.from('lots').select('*', { count: 'exact', head: true }).neq('status', 'hidden').eq('system_code', 'KHO_DONG_LANH');
    const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { count: tagCount } = await supabase.from('lot_tags').select('*', { count: 'exact', head: true });

    console.log({
        lotsInFrozen: lotCount,
        totalProducts: productCount,
        totalLotTags: tagCount
    });
}

checkCounts();
