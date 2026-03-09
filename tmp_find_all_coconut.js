
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAll() {
    const { data: lotTags, error } = await supabase
        .from('lot_tags')
        .select('tag, lot_id, lots(code, status, system_code, warehouse_name)')
        .ilike('tag', '%coconut%');

    if (error) {
        console.error(error);
        return;
    }

    const results = lotTags.map(lt => ({
        tag: lt.tag,
        lot: lt.lots?.code,
        status: lt.lots?.status,
        system: lt.lots?.system_code,
        warehouse: lt.lots?.warehouse_name
    }));

    console.log(JSON.stringify(results, null, 2));
}

checkAll();
