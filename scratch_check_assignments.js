const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    try {
        console.log('--- TEST QUERY CHÍNH XÁC CỦA CLIENT NEXT.JS ---');
        
        const systemCode = 'KHO_DONG_LANH';
        const dailySeqs = [634, 509, 632, 633, 635];
        const knownLotIds = [
            '5298a4b5-daae-45cc-b4a5-318a0dbfab8e',
            '51a01766-d8ec-47d6-9959-0b777f453d09',
            '9a77b9a9-a705-437d-b027-2f8758cbc155',
            '7123cf11-3df3-47d7-bef8-10b616d70309',
            '9d459776-a77a-44af-b117-9e7c2ee38ddf'
        ];

        let lotsQuery = supabase
            .from('lots')
            .select(`
                id, code, daily_seq, inbound_date,
                production_code,
                production_lot_id,
                production_lots!production_lot_id(lot_code),
                productions!production_id(code),
                lot_items(quantity, unit, products(name, sku, weight_kg))
            `)
            .eq('system_code', systemCode);
        
        const expandedDateFrom = '2026-04-03';
        const expandedDateTo = '2026-05-18T23:59:59';
        
        lotsQuery = lotsQuery.gte('inbound_date', expandedDateFrom).lte('inbound_date', expandedDateTo);

        if (knownLotIds.length > 0) {
            const idFilter = `id.in.(${knownLotIds.join(',')})`;
            const seqFilter = dailySeqs.length > 0 ? `,daily_seq.in.(${dailySeqs.join(',')})` : '';
            lotsQuery = lotsQuery.or(`${idFilter}${seqFilter}`);
        }

        const { data, error } = await lotsQuery.order('inbound_date', { ascending: false }).limit(5000);

        if (error) {
            console.error('❌ LỖI QUERY CHÍNH:', error);
        } else {
            console.log('✅ QUERY CHÍNH CHẠY THÀNH CÔNG!');
            console.log(`Tìm thấy ${data.length} lots.`);
            console.log('Mẫu lot đầu tiên:', JSON.stringify(data[0], null, 2));
        }

    } catch (e) {
        console.error('Exception:', e);
    }
}

main();
