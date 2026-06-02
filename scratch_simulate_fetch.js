const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- TÌM KIẾM MÃ CHỨA SỐ 014 HOẶC THÙNG SỐ 14 ---');
    try {
        const { data, error } = await supabase
            .from('box_labels')
            .select('id, code, created_at')
            .ilike('code', '%014%');

        if (error) {
            console.error('Lỗi truy vấn:', error);
            return;
        }

        console.log(`Tìm thấy ${data.length} bản ghi chứa '014':`);
        data.forEach(row => {
            console.log(`- Code: "${row.code}" | Tạo lúc: ${row.created_at}`);
        });

        console.log('\n--- TÌM KIẾM MÃ CHỨA SỐ 14 Ở CUỐI ---');
        const { data: data2, error: error2 } = await supabase
            .from('box_labels')
            .select('id, code, created_at')
            .ilike('code', '%-014');

        if (error2) {
            console.error('Lỗi truy vấn 2:', error2);
            return;
        }

        console.log(`Tìm thấy ${data2.length} bản ghi kết thúc bằng '-014':`);
        data2.forEach(row => {
            console.log(`- Code: "${row.code}" | Tạo lúc: ${row.created_at}`);
        });

    } catch (e) {
        console.error(e);
    }
}

main();
