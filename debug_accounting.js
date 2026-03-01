const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugAccountingHistory() {
    // 1. Get All Systems
    const { data: systems } = await supabase.from('systems').select('code, name');
    console.log('--- Available Systems ---');
    console.log(systems);

    // 2. Search Product TA in all systems
    const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, unit, system_type')
        .eq('sku', 'TA');

    console.log('\n--- Products with SKU "TA" ---');
    console.log(products);

    if (!products || products.length === 0) {
        console.log('Product TA not found even with service role key');
        return;
    }

    // Pick the first one for further analysis
    const p = products[0];
    const productId = p.id;
    const systemType = p.system_type;
    console.log(`\nAnalyzing Inbound for: ${p.name} (${productId}) in system: ${systemType}`);

    const startDate = '2026-03-01';
    const endDate = '2026-03-31 23:59:59';

    // 3. Fetch Inbound items for this product
    const { data: items, error } = await supabase
        .from('inbound_order_items')
        .select(`
            id, quantity, unit,
            order:inbound_orders!inner(code, created_at, order_type_id, status, type)
        `)
        .eq('product_id', productId)
        .eq('order.status', 'Completed')
        .gte('order.created_at', startDate)
        .lte('order.created_at', endDate);

    if (error) {
        console.error('Error fetching items:', error);
        return;
    }

    console.log('\n--- Inbound Items ---');
    items.forEach(item => {
        console.log(`Order: ${item.order.code} | Type: ${item.order.type} | TypeID: ${item.order.order_type_id} | Qty: ${item.quantity} ${item.unit} | Date: ${item.order.created_at}`);
    });

    // 4. Check Order Types
    const { data: orderTypes } = await supabase
        .from('order_types')
        .select('id, name, code, scope');

    console.log('\n--- Order Types ---');
    orderTypes.forEach(t => {
        console.log(`ID: ${t.id} | Name: ${t.name} | Scope: ${t.scope}`);
    });
}

debugAccountingHistory();
