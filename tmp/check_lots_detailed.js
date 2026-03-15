const https = require('https');
const fs = require('fs');

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
                    try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
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
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    try {
        log('--- FETCHING ALL PRODUCTS ---');
        const allProducts = await request('/products?select=id,name,unit');
        const srProducts = allProducts.filter(p => p.name && p.name.toLowerCase().includes('sầu riêng'));
        
        log(`Matching products: ${srProducts.length}`);
        
        for (const p of srProducts) {
            log(`\nChecking Lot for Product: ${p.name} (${p.id})`);
            
            // 1. Direct lots
            const lots = await request(`/lots?product_id=eq.${p.id}&select=code,status,system_code,quantity`);
            log(`- Direct Lots found: ${lots.length}`);
            lots.forEach(l => log(`  * Lot ${l.code} | Status: ${l.status} | System: ${l.system_code} | Qty: ${l.quantity}`));

            // 2. lot_items
            const items = await request(`/lot_items?product_id=eq.${p.id}&select=lot_id,quantity`);
            log(`- Items in other lots: ${items.length}`);
            if (items.length > 0) {
                const lIds = items.map(it => it.lot_id);
                const lIdsParam = encodeURIComponent(`in.(${lIds.join(',')})`);
                const parentLots = await request(`/lots?id=${lIdsParam}&select=id,code,status,system_code`);
                items.forEach(it => {
                    const pl = parentLots.find(l => l.id === it.lot_id);
                    log(`  * In Lot ${pl ? pl.code : it.lot_id} | Status: ${pl ? pl.status : '?'} | System: ${pl ? pl.system_code : '?'} | Qty: ${it.quantity}`);
                });
            }
        }
        
        fs.writeFileSync('d:\\toanthang\\web\\tmp\\sr_check_result.txt', output);
        log('\nResults saved to tmp\\sr_check_result.txt');

    } catch (e) {
        log('Error: ' + e.message);
    }
}

run();
