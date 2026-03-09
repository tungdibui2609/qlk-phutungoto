const https = require('https');

const API_URL = 'viqeyhpnevxcowsffueb.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

async function request(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_URL,
            port: 443,
            path: '/rest/v1' + path,
            method: 'GET',
            headers: {
                'apikey': API_KEY,
                'Authorization': `Bearer ${API_KEY}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                } else {
                    reject(new Error(`Status: ${res.statusCode}, Data: ${data}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function run() {
    try {
        const productNamePart = 'Sầu riêng cấp đông múi Dona/Monthong B To';
        const products = await request(`/products?name=ilike.*${encodeURIComponent(productNamePart)}*&select=*`);

        if (products.length === 0) {
            console.log('Product not found.');
            return;
        }

        const product = products[0];
        console.log(`Analyzing Product: "${product.name}" (ID: ${product.id})`);

        // Find lots using this product (either directly or via lot_items)
        const directLots = await request(`/lots?product_id=eq.${product.id}&select=id,code`);
        const lotItems = await request(`/lot_items?product_id=eq.${product.id}&select=lot_id`);

        const lotIds = new Set(directLots.map(l => l.id));
        lotItems.forEach(li => lotIds.add(li.lot_id));

        console.log(`Found ${lotIds.size} related lots.`);

        if (lotIds.size > 0) {
            const lotIdList = `(${Array.from(lotIds).join(',')})`;
            const positions = await request(`/positions?lot_id=in.${lotIdList}&select=id,code,system_type`);

            console.log(`Found ${positions.length} positions:`);
            positions.forEach(pos => {
                console.log(`- Position: ${pos.code}, System: ${pos.system_type}`);
            });

            // Also check if there are any lots that are NOT in positions
            for (const lotId of lotIds) {
                const pos = positions.find(p => p.lot_id === lotId);
                if (!pos) {
                    const lot = await request(`/lots?id=eq.${lotId}&select=code,warehouse_name`);
                    console.log(`- Lot ${lot[0]?.code} is NOT in any position. Warehouse: ${lot[0]?.warehouse_name}`);
                }
            }
        }
    } catch (e) {
        console.error(e.message);
    }
}

run();
