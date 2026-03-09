
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTag() {
    const results = {
        tags: [],
        items: [],
        lots: []
    };

    const { data: lotTags } = await supabase
        .from('lot_tags')
        .select('tag, lot_id, lot_item_id, lots(id, code, status, system_code)')
        .ilike('tag', '%coconut%');

    results.tags = lotTags || [];

    if (lotTags && lotTags.length > 0) {
        const lotIds = Array.from(new Set(lotTags.map(lt => lt.lot_id)));
        const { data: items } = await supabase.from('lot_items').select('*').in('lot_id', lotIds);
        results.items = items || [];

        const { data: lots } = await supabase.from('lots').select('*').in('id', lotIds);
        results.lots = lots || [];
    }

    console.log(JSON.stringify(results, null, 2));
}

checkTag();
