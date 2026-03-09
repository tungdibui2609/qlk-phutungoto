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
        console.log('--- PRODUCT NAMES LIST ---');
        const searchTerm = encodeURIComponent('.*Sầu riêng*');
        const prods = await request(`/products?name=ilike.${searchTerm}&select=id,name,sku,internal_code`);

        if (!Array.isArray(prods)) {
            console.log('Error or no products found:', prods);
            return;
        }

        prods.forEach(p => {
            console.log(`ID: ${p.id}`);
            console.log(`Name: "${p.name}" (Length: ${p.name.length})`);
            console.log(`SKU: ${p.sku}`);
            console.log(`Internal Code: ${p.internal_code}`);
            console.log('---');
        });

        if (prods.length > 0) {
            console.log('\n--- LOT ASSIGNMENTS ---');
            for (const p of prods) {
                const lotItems = await request(`/lot_items?product_id=eq.${p.id}&select=lot_id`);
                const lotIds = Array.from(new Set(lotItems.map(li => li.lot_id)));

                if (lotIds.length > 0) {
                    const idChunk = lotIds.slice(0, 50).join(',');
                    const positions = await request(`/positions?lot_id=in.(${idChunk})&select=code,system_type`);
                    console.log(`Product "${p.name}": ${lotIds.length} lots, ${positions.length} assigned to positions.`);
                    if (positions.length > 0) {
                        console.log(`  Assigned Positions: ${positions.map(pos => `${pos.code}(${pos.system_type})`).join(', ')}`);
                    }
                } else {
                    const directLots = await request(`/lots?product_id=eq.${p.id}&select=id`);
                    if (directLots.length > 0) {
                        const dLotIds = directLots.map(l => l.id);
                        const positions = await request(`/positions?lot_id=in.(${dLotIds.slice(0, 50).join(',')})&select=code,system_type`);
                        console.log(`Product "${p.name}": ${dLotIds.length} direct lots, ${positions.length} assigned to positions.`);
                    } else {
                        console.log(`Product "${p.name}": No lots found.`);
                    }
                }
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
