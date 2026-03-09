
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBăngKeo() {
    const { data: lotTags, error } = await supabase
        .from('lot_tags')
        .select('tag, lot_id, lot_item_id')
        .ilike('tag', '%băng keo%')
        .limit(5);

    if (error) {
        console.error(error);
        return;
    }

    console.log("Băng keo tags sample:", JSON.stringify(lotTags, null, 2));
}

checkBăngKeo();
