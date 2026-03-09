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
        console.log('--- DANH SACH VI TRI CUA TAT CA SAN PHAM SAU RIENG ---');

        // 1. Get all products with "Sầu riêng"
        const prods = await request('/products?select=id,name&limit=2000');
        const sauRiengProds = prods.filter(p => p.name && p.name.includes('Sầu riêng'));

        const prodMap = {};
        sauRiengProds.forEach(p => prodMap[p.id] = p.name);

        const prodIds = sauRiengProds.map(p => p.id);

        // 2. Find all lots for these products
        let allLotIds = [];
        for (let i = 0; i < prodIds.length; i += 100) {
            const batch = prodIds.slice(i, i + 100);
            const lots = await request(`/lots?product_id=in.(${batch.join(',')})&select=id,code,product_id`);
            allLotIds.push(...lots);

            const lotItems = await request(`/lot_items?product_id=in.(${batch.join(',')})&select=lot_id,product_id`);
            lotItems.forEach(li => {
                allLotIds.push({ id: li.lot_id, product_id: li.product_id, isItem: true });
            });
        }

        const lotToProd = {};
        allLotIds.forEach(l => {
            lotToProd[l.id] = prodMap[l.product_id];
        });

        const uniqueLotIds = Array.from(new Set(allLotIds.map(l => l.id)));

        // 3. Find positions for these lots
        const results = [];
        for (let i = 0; i < uniqueLotIds.length; i += 100) {
            const batch = uniqueLotIds.slice(i, i + 100);
            const positions = await request(`/positions?lot_id=in.(${batch.join(',')})&select=code,system_type,lot_id`);
            positions.forEach(pos => {
                results.push({
                    pos: pos.code,
                    system: pos.system_type,
                    product: lotToProd[pos.lot_id]
                });
            });
        }

        if (results.length === 0) {
            console.log('Khong tim thay vi tri nao duoc gan cho cac san pham Sau Rieng.');
        } else {
            console.log(`Tim thay ${results.length} vi tri gan san pham Sau Rieng:`);
            results.sort((a, b) => a.pos.localeCompare(b.pos));
            results.forEach(r => {
                console.log(`[${r.system}] ${r.pos} -> ${r.product}`);
            });
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
