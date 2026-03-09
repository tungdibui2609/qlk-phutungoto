
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function compare() {
    const { data: tags } = await supabase
        .from('lot_tags')
        .select('tag, lots(code, system_code, warehouse_name)')
        .or('tag.ilike.%coconut%,tag.ilike.%băng keo%');

    const comparison = {};
    tags?.forEach(t => {
        const tag = t.tag.toUpperCase();
        if (!comparison[tag]) comparison[tag] = new Set();
        comparison[tag].add(`${t.lots?.system_code} (${t.lots?.warehouse_name})`);
    });

    const final = {};
    for (const t in comparison) {
        final[t] = Array.from(comparison[t]);
    }
    console.log(JSON.stringify(final, null, 2));
}

compare();
