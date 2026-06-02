const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function fetchAllPaginated(table, filter, selectFields = '*', pageSize = 1000) {
    let allData = [];
    let from = 0;
    let pages = 0;
    while (true) {
        let query = supabase.from(table).select(selectFields).range(from, from + pageSize - 1);
        if (filter) query = filter(query);
        const { data, error } = await query;
        if (error) {
            console.error(`Error fetching ${table}:`, error);
            break;
        }
        if (!data || data.length === 0) break;
        allData = [...allData, ...data];
        pages++;
        if (data.length < pageSize) break;
        from += pageSize;
    }
    return allData;
}

async function main() {
    console.log('--- KHẢO SÁT ẢNH HƯỞNG CỦA ORDER TRONG PHÂN TRANG (SAU KHI THÊM ID TIE-BREAKER) ---');
    try {
        const systemCode = 'KHO_DONG_LANH';

        console.log('\n1. Fetch CÓ .order("level").order("name").order("id"):');
        const zonesWithOrder = await fetchAllPaginated('zones', 
            q => q.eq('system_type', systemCode).order('level').order('name').order('id'),
            'id, parent_id, name, code, level, display_order, system_type'
        );

        // Check xem có bị trùng lặp ID không
        const orderIds = zonesWithOrder.map(z => z.id);
        const uniqueOrderIds = new Set(orderIds);
        console.log(`\nCó order + id: Tổng số fetched: ${zonesWithOrder.length} | Unique IDs: ${uniqueOrderIds.size} | Trùng lặp: ${zonesWithOrder.length - uniqueOrderIds.size}`);

        // Check xem target zone ID 8a8fdd44-4204-4077-9ca9-068f494ed749 (Tầng 1 Ô B03) có trong cả hai không
        const targetId = '8a8fdd44-4204-4077-9ca9-068f494ed749';
        console.log(`\nCó target ID '${targetId}' trong zones CÓ order + id?`, uniqueOrderIds.has(targetId));

        // Check xem target zone ID ce1043a0-25fe-49b2-aef2-c51a0fb42a30 (Tầng 1 Ô C03) có trong cả hai không
        const targetId2 = 'ce1043a0-25fe-49b2-aef2-c51a0fb42a30';
        console.log(`Có target ID '${targetId2}' trong zones CÓ order + id?`, uniqueOrderIds.has(targetId2));

    } catch (e) {
        console.error(e);
    }
}

main();
