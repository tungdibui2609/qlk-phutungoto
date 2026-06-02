const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- IN CHI TIẾT CẤU TRÚC POSITION VÀ ZONE_POSITIONS ---');
    try {
        const systemCode = 'KHO_DONG_LANH';

        const { data: posList, error: posErr } = await supabase
            .from('positions')
            .select('*, zone_positions(zone_id), lots:lots!positions_lot_id_fkey(*)')
            .eq('system_type', systemCode)
            .or('code.eq.K2D4B03T101,code.eq.K2D4A03T101,code.eq.K2D4B03T102');

        if (posErr) throw posErr;
        
        console.log(JSON.stringify(posList, null, 2));

    } catch (e) {
        console.error('Lỗi:', e);
    }
}

main();
