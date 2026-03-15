const https = require('https');

const API_URL = 'viqeyhpnevxcowsffueb.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

async function request(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_URL, port: 443, path: '/rest/v1' + path, method: 'GET',
            headers: { 'apikey': API_KEY, 'Authorization': `Bearer ${API_KEY}` }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
                } else { reject(new Error(`Status: ${res.statusCode}, Data: ${data}`)); }
            });
        });
        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function run() {
    try {
        const productId = 'b406fdcc-da1e-407f-8209-1153ea73d798'; // Sầu riêng Dona C kem
        const products = await request(`/products?id=eq.${productId}&select=id,name,sku,internal_name,internal_code,unit`);
        console.log('--- PRODUCT INFO ---');
        console.log(JSON.stringify(products[0], null, 2));

        console.log('\n--- ACTIVE LOT ITEMS FOR THIS PRODUCT ---');
        const items = await request(`/lot_items?product_id=eq.${productId}&select=id,quantity,unit,lot_id`);
        console.log(`Found ${items.length} items.`);
        
        let total = 0;
        for (const it of items) {
            const lot = await request(`/lots?id=eq.${it.lot_id}&select=code,status,system_code`);
            if (lot[0]?.status === 'active') {
                console.log(`- Lot: ${lot[0].code} | System: ${lot[0].system_code} | Qty: ${it.quantity} ${it.unit || '?'}`);
                total += it.quantity;
            }
        }
        console.log(`Total active quantity: ${total}`);
    } catch (e) { console.error('Error:', e.message); }
}
run();
