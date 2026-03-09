const https = require('https');

const API_URL = 'viqeyhpnevxcowsffueb.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

async function request(path, range = null) {
    return new Promise((resolve, reject) => {
        const headers = {
            'apikey': API_KEY,
            'Authorization': `Bearer ${API_KEY}`
        };
        if (range) {
            headers['Range'] = range;
        }

        const options = {
            hostname: API_URL,
            port: 443,
            path: '/rest/v1' + path,
            method: 'GET',
            headers: headers
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
        console.log('Querying distinct system types in positions table...');
        let allSystems = new Set();
        let from = 0;
        const limit = 1000;

        while (from < 10000) {
            const data = await request(`/positions?select=system_type`, `${from}-${from + limit - 1}`);
            if (!data || data.length === 0) break;
            data.forEach(p => allSystems.add(p.system_type));
            if (data.length < limit) break;
            from += limit;
        }

        console.log('Distinct System Types found in positions:', Array.from(allSystems));

        // Now check if the specific product's lots are in positions with these system types
        const productNamePart = 'Sầu riêng cấp đông múi Dona/Monthong B To';
        const products = await request(`/products?name=ilike.*${encodeURIComponent(productNamePart)}*&select=id,name`);

        if (products.length > 0) {
            const product = products[0];
            console.log(`\nProduct found: "${product.name}" (ID: ${product.id})`);

            // Search in lot_items
            const lotItems = await request(`/lot_items?product_id=eq.${product.id}&select=lot_id`);
            const lotIds = Array.from(new Set(lotItems.map(li => li.lot_id)));

            if (lotIds.length > 0) {
                const lotIdList = `(${lotIds.join(',')})`;
                const positions = await request(`/positions?lot_id=in.${lotIdList}&select=code,system_type`);
                console.log(`\nProduct "${product.name}" positions:`);
                if (positions.length === 0) {
                    console.log('- No positions assigned to these lots.');
                }
                positions.forEach(pos => {
                    console.log(`- Position ${pos.code} has System Type: ${pos.system_type}`);
                });

                // Check for lots NOT in positions
                for (const lotId of lotIds) {
                    const pos = positions.find(p => p.lot_id === lotId);
                    if (!pos) {
                        const lot = await request(`/lots?id=eq.${lotId}&select=code,warehouse_name,system_code`);
                        console.log(`- Lot ${lot[0]?.code} is NOT in any position. Warehouse: ${lot[0]?.warehouse_name}, System: ${lot[0]?.system_code}`);
                    }
                }
            } else {
                console.log('- No lots found for this product.');
            }
        } else {
            console.log(`- Product matching "${productNamePart}" not found.`);
        }
    } catch (e) {
        console.error(e.message);
    }
}

run();
