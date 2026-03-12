
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim().replace(/^"(.*)"$/, '$1');
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('Checking lot_items and lot_tags relationship...');

    // Let's look at one specific lot with multiple items
    const { data: lot } = await supabase
        .from('lots')
        .select(`
            id, code,
            lot_items(*),
            lot_tags(*)
        `)
        .eq('code', 'LT1003-00008')
        .single();

    if (lot) {
        console.log('Lot:', lot.code);
        console.log('Lot Items:', lot.lot_items);
        console.log('Lot Tags:', lot.lot_tags);
    } else {
        // Try to find any lot with multiple items
        const { data: multipleLots } = await supabase
            .from('lots')
            .select('id, code, lot_items(id)')
            .limit(10);
            
        for (const ml of multipleLots || []) {
            if (ml.lot_items && ml.lot_items.length > 1) {
                console.log('Found lot with multiple items:', ml.code);
                const { data: detail } = await supabase
                    .from('lots')
                    .select('id, code, lot_items(*), lot_tags(*)')
                    .eq('id', ml.id)
                    .single();
                console.log('Items:', detail.lot_items);
                console.log('Tags:', detail.lot_tags);
                break;
            }
        }
    }
    
    // Check if lot_tags has a lot_item_id column
    const { data: columns, error } = await supabase.rpc('get_column_names', { table_name: 'lot_tags' });
    if (error) {
        console.log('Could not get columns via RPC, trying a select * limit 1');
        const { data: sampleTag } = await supabase.from('lot_tags').select('*').limit(1);
        if (sampleTag && sampleTag.length > 0) {
            console.log('Sample lot_tag structure:', Object.keys(sampleTag[0]));
        }
    } else {
        console.log('lot_tags columns:', columns);
    }
}

checkSchema();
