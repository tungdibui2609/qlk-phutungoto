const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
try {
    const envPath = path.join(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimLine = line.trim();
            if (trimLine && !trimLine.startsWith('#')) {
                const index = trimLine.indexOf('=');
                if (index !== -1) {
                    const key = trimLine.substring(0, index).trim();
                    let value = trimLine.substring(index + 1).trim();
                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.substring(1, value.length - 1);
                    }
                    process.env[key] = value;
                }
            }
        });
    }
} catch (err) {
    console.error('Không thể load file .env.local:', err.message);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
    console.error('LỖI: Không tìm thấy SUPABASE_SERVICE_ROLE_KEY trong tệp .env.local!');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function runPerformanceTest() {
    console.log('======================================================');
    console.log('   BẮT ĐẦU ĐO LƯỜNG HIỆU NĂNG TRUY VẤN WMS DATABASE   ');
    console.log('======================================================');
    console.log(`Supabase URL: ${SUPABASE_URL}`);
    console.log('Kết nối thành công. Đang tiến hành chạy các test case...\n');

    const testCompanyId = '568898ee-d254-4ede-be33-bdc829a5c3f6'; // Công ty Chánh Thu

    // Test Case 1: Lấy danh sách Lot có filter theo company_id (Mô phỏng truy vấn UI)
    console.log('--- Test Case 1: SELECT Lots filter company_id (Join 3 tầng cơ bản) ---');
    try {
        const start = Date.now();
        const { data, error } = await supabase
            .from('lots')
            .select('id, code, status, products(name, sku), suppliers(name)')
            .eq('company_id', testCompanyId)
            .limit(100);

        if (error) throw error;
        const duration = Date.now() - start;
        console.log(`✅ Thành công! Tải được ${data.length} lots.`);
        console.log(`⏱️ Thời gian phản hồi: ${duration} ms\n`);
    } catch (err) {
        console.error('❌ Lỗi Test Case 1:', err.message);
    }

    // Test Case 2: Truy vấn Deep Search (Mô phỏng tìm kiếm lô hàng)
    console.log('--- Test Case 2: Deep Join SELECT trên bảng Lot Items ---');
    try {
        const start = Date.now();
        const { data, error } = await supabase
            .from('lot_items')
            .select('id, quantity, products(name, sku), lots(code, company_id)')
            .eq('company_id', testCompanyId)
            .limit(100);

        if (error) throw error;
        const duration = Date.now() - start;
        console.log(`✅ Thành công! Tải được ${data.length} lot items.`);
        console.log(`⏱️ Thời gian phản hồi: ${duration} ms\n`);
    } catch (err) {
        console.error('❌ Lỗi Test Case 2:', err.message);
    }

    // Test Case 3: Lấy danh sách Products của công ty
    console.log('--- Test Case 3: SELECT Products filter company_id ---');
    try {
        const start = Date.now();
        const { data, error } = await supabase
            .from('products')
            .select('id, name, sku')
            .eq('company_id', testCompanyId)
            .limit(100);

        if (error) throw error;
        const duration = Date.now() - start;
        console.log(`✅ Thành công! Tải được ${data.length} products.`);
        console.log(`⏱️ Thời gian phản hồi: ${duration} ms\n`);
    } catch (err) {
        console.error('❌ Lỗi Test Case 3:', err.message);
    }

    // Test Case 4: Lọc Vị Trí (Positions) theo công ty
    console.log('--- Test Case 4: SELECT Positions filter company_id ---');
    try {
        const start = Date.now();
        const { data, error } = await supabase
            .from('positions')
            .select('id, code')
            .eq('company_id', testCompanyId)
            .limit(100);

        if (error) throw error;
        const duration = Date.now() - start;
        console.log(`✅ Thành công! Tải được ${data.length} positions.`);
        console.log(`⏱️ Thời gian phản hồi: ${duration} ms\n`);
    } catch (err) {
        console.error('❌ Lỗi Test Case 4:', err.message);
    }

    console.log('======================================================');
    console.log('   ĐO LƯỜNG HOÀN TẤT. VUI LÒNG GHI LẠI THỜI GIAN CHẠY   ');
    console.log('======================================================');
}

runPerformanceTest();
