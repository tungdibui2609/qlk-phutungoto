const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- KHẢO SÁT BẢNG lot_items CHO CÁC LOTS ---');
    try {
        const lotIds = [
            '54930e8c-39b9-479a-a7c4-b9ac1d3ae165', // DL-LOT-100326-006 (hiển thị)
            '730bf2ec-7311-4a61-a634-007edf36dd81', // DL-LOT-110326-002 (bị ẩn)
            'ba8c8d55-5d77-41a2-9cec-bce49913f5b8'  // DL-LOT-100326-006 (ở Tầng 2)
        ];

        const { data: items, error } = await supabase
            .from('lot_items')
            .select('*, products(*)')
            .in('lot_id', lotIds);

        if (error) throw error;

        console.log(`Tìm thấy ${items.length} items:`);
        items.forEach(item => {
            console.log(`- Item ID: ${item.id} | Lot ID: ${item.lot_id} | Product: ${item.products?.name} (SKU: ${item.products?.sku}) | Qty: ${item.quantity} | Unit: ${item.unit}`);
        });

    } catch (e) {
        console.error('Lỗi:', e);
    }
}

main();
