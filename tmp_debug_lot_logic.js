
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLot() {
    const lotCode = 'DL-LOT-090326-024';
    const { data: lot, error } = await supabase
        .from('lots')
        .select(`
        id,
        code,
        warehouse_name,
        status,
        lot_items (
            id,
            product_id,
            quantity,
            unit
        ),
        lot_tags (
            tag,
            lot_item_id
        )
    `)
        .eq('code', lotCode)
        .single();

    if (error) {
        console.error(error);
        return;
    }

    console.log("LOT structure:", JSON.stringify(lot, null, 2));

    // Simulation of loop
    const generalTags = (lot.lot_tags || [])
        .filter((t) => !t.lot_item_id)
        .map((t) => t.tag);

    const itemTagsMap = new Map();
    (lot.lot_tags || []).filter((t) => t.lot_item_id).forEach((t) => {
        if (!itemTagsMap.has(t.lot_item_id)) itemTagsMap.set(t.lot_item_id, []);
        itemTagsMap.get(t.lot_item_id).push(t.tag);
    });

    console.log("General Tags:", generalTags);
    lot.lot_items.forEach(item => {
        const specificTags = itemTagsMap.get(item.id) || [];
        const combined = Array.from(new Set([...generalTags, ...specificTags]));
        console.log(`Item ${item.id} combined tags:`, combined);
    });
}

debugLot();
