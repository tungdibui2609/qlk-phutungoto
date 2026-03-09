
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyRange() {
    const { data: lots, error } = await supabase
        .from('lots')
        .select(`
        id,
        code,
        lot_tags (
            tag
        )
    `)
        .neq('status', 'hidden')
        .eq('system_code', 'KHO_DONG_LANH')
        .range(1000, 1999); // Second page

    if (error) {
        console.error(error);
        return;
    }

    console.log("Total lots fetched (Page 2):", lots.length);

    const tags = new Set();
    lots.forEach(lot => {
        lot.lot_tags?.forEach(t => tags.add(t.tag));
    });

    console.log("Tags found in Page 2:", Array.from(tags).filter(t => t.includes('COCONUT')));
}

verifyRange();
