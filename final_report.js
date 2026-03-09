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
        console.log('--- FINAL COMPREHENSIVE SAU RIENG REPORT ---');
        const prods = await request(`/products?select=id,name&limit=2000`);
        const sauRiengProds = prods.filter(p => p.name && p.name.includes('Sầu riêng'));

        for (const p of sauRiengProds) {
            console.log(`\nPRODUCT: "${p.name}"`);

            // Get all lots
            const directLots = await request(`/lots?product_id=eq.${p.id}&select=id,code`);
            const lotItems = await request(`/lot_items?product_id=eq.${p.id}&select=lot_id`);
            const allLotIds = Array.from(new Set([
                ...directLots.map(l => l.id),
                ...lotItems.map(li => li.lot_id)
            ]));

            console.log(`- Total Lots: ${allLotIds.size}`);

            if (allLotIds.size > 0) {
                // Check assignments in batches of 100
                let totalAssigned = 0;
                let samplePositions = [];

                for (let i = 0; i < allLotIds.size; i += 100) {
                    const batch = allLotIds.slice(i, i + 100);
                    const positions = await request(`/positions?lot_id=in.(${batch.join(',')})&select=code,system_type`);
                    totalAssigned += positions.length;
                    if (samplePositions.length < 5) samplePositions.push(...positions.map(pos => pos.code));
                }

                console.log(`- Assigned to positions: ${totalAssigned}`);
                if (totalAssigned > 0) {
                    console.log(`  Sample positions: ${samplePositions.slice(0, 5).join(', ')}`);
                }
            } else {
                console.log(`- [NOTICE] This product has NO LOTS in the system.`);
            }
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
