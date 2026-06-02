const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    console.log('--- TÌM KIẾM SẢN PHẨM THEO SKU ---');
    try {
        const skuToSearch = 'TP112010902.001.02';
        
        console.log(`Tìm kiếm sản phẩm có SKU là "${skuToSearch}"...`);
        const { data, error } = await supabase
            .from('products')
            .select('id, name, sku, system_code, company_id')
            .eq('sku', skuToSearch);

        if (error) {
            console.error('Lỗi truy vấn:', error);
            return;
        }

        console.log(`Tìm thấy ${data.length} sản phẩm:`);
        data.forEach(row => {
            console.log(`- ID:          "${row.id}"`);
            console.log(`  Name:        "${row.name}"`);
            console.log(`  SKU:         "${row.sku}"`);
            console.log(`  System Code: "${row.system_code}"`);
            console.log(`  Company ID:  "${row.company_id}"`);
        });

        console.log('\n--- TÌM KIẾM SẢN PHẨM KHÔNG PHÂN BIỆT SYSTEM_CODE BẰNG SKU CLEAN ---');
        const { data: allProducts, error: errAll } = await supabase
            .from('products')
            .select('id, name, sku, system_code, company_id');
            
        if (errAll) {
            console.error('Lỗi lấy tất cả sản phẩm:', errAll);
            return;
        }
        
        const skuClean = 'TP11201090200102';
        const matches = allProducts.filter(p => p.sku.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === skuClean);
        console.log(`Tìm thấy ${matches.length} sản phẩm khớp SKU Clean "${skuClean}":`);
        matches.forEach(row => {
            console.log(`- ID:          "${row.id}"`);
            console.log(`  Name:        "${row.name}"`);
            console.log(`  SKU:         "${row.sku}"`);
            console.log(`  System Code: "${row.system_code}"`);
            console.log(`  Company ID:  "${row.company_id}"`);
        });

    } catch (e) {
        console.error(e);
    }
}

main();
