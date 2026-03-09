
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
    const { data: lots } = await supabase
        .from('lots')
        .select('warehouse_name, lot_tags(tag)')
        .eq('status', 'active')
        .eq('system_code', 'KHO_DONG_LANH');

    const stats = {};
    lots?.forEach(l => {
        const wh = l.warehouse_name || 'No Warehouse';
        if (!stats[wh]) stats[wh] = new Set();
        l.lot_tags?.forEach(t => stats[wh].add(t.tag));
    });

    const finalStats = {};
    for (const wh in stats) {
        finalStats[wh] = Array.from(stats[wh]).sort();
    }
    console.log(JSON.stringify(finalStats, null, 2));
}

analyze();
