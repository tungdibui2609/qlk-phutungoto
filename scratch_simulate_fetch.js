const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- THỐNG KÊ COMPANY_ID TRONG BẢNG box_labels ---');
    try {
        const { data, error } = await supabase
            .from('box_labels')
            .select('company_id');

        if (error) {
            console.error('Lỗi truy vấn:', error);
            return;
        }

        let nullCount = 0;
        let nonNullCount = 0;
        const uniqueCompanyIds = new Set();

        data.forEach(row => {
            if (row.company_id === null) {
                nullCount++;
            } else {
                nonNullCount++;
                uniqueCompanyIds.add(row.company_id);
            }
        });

        console.log(`Tổng số dòng box_labels: ${data.length}`);
        console.log(`Số dòng có company_id IS NULL: ${nullCount}`);
        console.log(`Số dòng có company_id NOT NULL: ${nonNullCount}`);
        console.log(`Các company_id duy nhất tồn tại:`, Array.from(uniqueCompanyIds));

    } catch (e) {
        console.error(e);
    }
}

main();
