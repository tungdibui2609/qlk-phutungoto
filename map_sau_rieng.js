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
        console.log('--- FETCHING ALL POSITIONS WITH LOTS ---');
        // Fetch all positions that have a lot_id
        const positions = await request('/positions?lot_id=not.is.null&select=code,lot_id,system_type');
        console.log(`Found ${positions.length} positions with lots.`);

        const lotIds = positions.map(p => p.lot_id);
        const lotMap = {};

        console.log('--- FETCHING LOTS AND PRODUCTS ---');
        // Fetch lot and product info in batches
        for (let i = 0; i < lotIds.length; i += 100) {
            const batch = lotIds.slice(i, i + 100);
            const batchLots = await request(`/lots?id=in.(${batch.join(',')})&select=id,code,products(name,sku)`);
            batchLots.forEach(l => {
                lotMap[l.id] = l;
            });

            // Also check lot_items if direct product is null
            const batchLotItems = await request(`/lot_items?lot_id=in.(${batch.join(',')})&select=lot_id,products(name,sku)`);
            batchLotItems.forEach(li => {
                if (!lotMap[li.lot_id]) return;
                if (!lotMap[li.lot_id].items) lotMap[li.lot_id].items = [];
                lotMap[li.lot_id].items.push(li.products);
            });
        }

        console.log('\n--- SAU RIENG POSITIONS FOUND ---');
        const results = [];
        positions.forEach(pos => {
            const lot = lotMap[pos.lot_id];
            if (!lot) return;

            let isSauRieng = false;
            let productName = '';

            if (lot.products && lot.products.name && lot.products.name.includes('Sầu riêng')) {
                isSauRieng = true;
                productName = lot.products.name;
            } else if (lot.items) {
                const item = lot.items.find(it => it.name && it.name.includes('Sầu riêng'));
                if (item) {
                    isSauRieng = true;
                    productName = item.name;
                }
            }

            if (isSauRieng) {
                results.push({
                    position: pos.code,
                    system: pos.system_type,
                    product: productName,
                    lot: lot.code
                });
            }
        });

        if (results.length > 0) {
            results.sort((a, b) => a.position.localeCompare(b.position));
            results.forEach(r => {
                console.log(`[${r.system}] Position: ${r.position} | Lot: ${r.lot} | Product: ${r.product}`);
            });
        } else {
            console.log('No Sau Rieng products found on the map.');
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
