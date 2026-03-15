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
    try {
        console.log('--- FETCHING ALL LOTS (ANY STATUS) TO FIND SẦU RIÊNG ---');
        // Fetch lots and products
        const lots = await request('/lots?select=id,code,status,system_code,products(name,unit)');
        const sauRiengLots = lots.filter(l => l.products && l.products.name && l.products.name.toLowerCase().includes('sầu riêng'));
        
        console.log(`Found ${sauRiengLots.length} lots (any status) with "Sầu riêng" as primary product.`);
        sauRiengLots.forEach(l => {
            console.log(`- Lot: ${l.code} | Status: ${l.status} | System: ${l.system_code} | Product: ${l.products.name}`);
        });

        // Also check positions
        console.log('\n--- CHECKING POSITIONS FOR SẦU RIÊNG ---');
        const positions = await request('/positions?lot_id=not.is.null&select=code,lot_id,system_type');
        const posLotIds = positions.map(p => p.lot_id);
        
        for (let i = 0; i < posLotIds.length; i += 100) {
             const chunk = posLotIds.slice(i, i + 100);
             const chunkLots = await request(`/lots?id=in.(${chunk.join(',')})&select=id,code,status,system_code,products(name,unit)`);
             const srLotsInPos = chunkLots.filter(l => l.products && l.products.name && l.products.name.toLowerCase().includes('sầu riêng'));
             srLotsInPos.forEach(l => {
                 const pos = positions.find(p => p.lot_id === l.id);
                 console.log(`- Lot ${l.code} [${l.status}] in Position ${pos.code} [${pos.system_type}] is Sầu riêng`);
             });
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
