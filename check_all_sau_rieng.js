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
        console.log('--- LISTING PRODUCTS TO FIND SAU RIENG ---');
        const prods = await request(`/products?select=id,name&limit=1000`);

        const sauRiengProds = prods.filter(p => p.name && p.name.includes('Sầu riêng'));
        console.log(`Found ${sauRiengProds.length} products containing "Sầu riêng" in first 1000 items:`);

        for (const p of sauRiengProds) {
            console.log(`\nProduct: "${p.name}" (ID: ${p.id})`);

            // Get lots
            const directLots = await request(`/lots?product_id=eq.${p.id}&select=id,code`);
            const lotItems = await request(`/lot_items?product_id=eq.${p.id}&select=lot_id`);
            const allLotIds = new Set(directLots.map(l => l.id));
            lotItems.forEach(li => allLotIds.add(li.lot_id));

            console.log(`- Total Lots: ${allLotIds.size}`);

            if (allLotIds.size > 0) {
                const idArr = Array.from(allLotIds);
                // Supabase in filter has limits on length, but let's try
                const positions = await request(`/positions?lot_id=in.(${idArr.slice(0, 100).join(',')})&select=code,system_type`);
                console.log(`- Lots assigned to positions (sample 100): ${positions.length}`);
                if (positions.length > 0) {
                    console.log(`  Assigned to: ${positions.length} positions. Sample codes: ${positions.slice(0, 5).map(pos => pos.code).join(', ')}`);
                }
            }
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
