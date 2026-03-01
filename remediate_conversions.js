const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function remediateConversionTypes() {
    const targetTypeId = '17d046f5-0c11-4d76-915c-754601111974'; // ID for "Chuyển Đổi"

    console.log(`Starting remediation for type: ${targetTypeId}`);

    // 1. Update inbound_orders
    const { data: inData, error: inError, count: inCount } = await supabase
        .from('inbound_orders')
        .update({ order_type_id: targetTypeId })
        .eq('type', 'Conversion')
        .is('order_type_id', null)
        .select('id');

    if (inError) {
        console.error('Error updating inbound_orders:', inError);
    } else {
        console.log(`Updated ${inData?.length || 0} inbound_orders.`);
    }

    // 2. Update outbound_orders
    const { data: outData, error: outError, count: outCount } = await supabase
        .from('outbound_orders')
        .update({ order_type_id: targetTypeId })
        .eq('type', 'Conversion')
        .is('order_type_id', null)
        .select('id');

    if (outError) {
        console.error('Error updating outbound_orders:', outError);
    } else {
        console.log(`Updated ${outData?.length || 0} outbound_orders.`);
    }

    console.log('Remediation complete.');
}

remediateConversionTypes();
