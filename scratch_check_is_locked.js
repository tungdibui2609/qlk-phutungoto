const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    try {
        console.log('--- ĐANG KIỂM TRA DỮ LIỆU KHÓA MÃ LOT TRONG DATABASE ---');
        
        // Lấy danh sách các mã lot có is_locked = true
        const { data: lockedLots, error } = await supabase
            .from('production_lots')
            .select('id, lot_code, is_locked, production_id, created_at')
            .eq('is_locked', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Lỗi khi truy vấn production_lots:', error);
            return;
        }

        console.log(`\n[KẾT QUẢ] Tìm thấy ${lockedLots.length} mã lot đã bị khóa (is_locked = true) trong database.`);
        if (lockedLots.length > 0) {
            console.log('\nDanh sách 10 mã lot đã khóa gần nhất:');
            lockedLots.slice(0, 10).forEach(lot => {
                console.log(`- ID: ${lot.id} | Mã Lot: ${lot.lot_code} | Trạng thái is_locked: ${lot.is_locked} | Ngày tạo: ${lot.created_at}`);
            });
        } else {
            console.log('\nKhông tìm thấy mã lot nào đang bị khóa trong database bằng điều kiện eq(is_locked, true).');
            
            // Thử lấy ngẫu nhiên 5 lots bất kỳ để xem cấu trúc và giá trị của cột is_locked
            console.log('\nKiểm tra cấu trúc 5 mã lot bất kỳ:');
            const { data: anyLots, error: anyError } = await supabase
                .from('production_lots')
                .select('id, lot_code, is_locked')
                .limit(5);
                
            if (anyError) {
                console.error('Lỗi khi truy vấn 5 lots ngẫu nhiên:', anyError);
            } else {
                anyLots.forEach(lot => {
                    console.log(`- Mã Lot: ${lot.lot_code} | Giá trị is_locked hiện tại: ${lot.is_locked}`);
                });
            }
        }
        
    } catch (e) {
        console.error('Exception:', e);
    }
}

main();
