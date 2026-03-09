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
        console.log('Searching for "Hầm đông" in lot warehouse names...');
        const lotsWithHamDong = await request(`/lots?warehouse_name=ilike.*${encodeURIComponent('Hầm đông')}*&select=warehouse_name&limit=1`);
        console.log('Match in lots.warehouse_name:', lotsWithHamDong);

        const pid = '37a70183-f368-450a-867c-9b78119ae464';
        console.log(`\nAnalyzing Lots for Product ID: ${pid}`);

        // 1. Direct product_id in lots
        const directLots = await request(`/lots?product_id=eq.${pid}&select=id,code,warehouse_name,system_code,created_at&order=created_at.desc`);
        console.log(`Found ${directLots.length} direct lots.`);
        if (directLots.length > 0) {
            console.log('Sample direct lots:', JSON.stringify(directLots.slice(0, 5), null, 2));
        }

        // 2. Via lot_items
        const lotItems = await request(`/lot_items?product_id=eq.${pid}&select=lot_id,quantity`);
        console.log(`Found ${lotItems.length} lot items.`);
        if (lotItems.length > 0) {
            const lotIds = Array.from(new Set(lotItems.map(li => li.lot_id)));
            const lotIdList = `(${lotIds.slice(0, 50).join(',')})`; // Limit to 50 for query
            const lotsFromItems = await request(`/lots?id=in.${lotIdList}&select=id,code,warehouse_name,system_code`);
            console.log(`Sample lots from lot_items:`, JSON.stringify(lotsFromItems.slice(0, 5), null, 2));
        }

        // 3. Find if ANY lot for this product is in a position
        console.log('\nChecking if any of these lots are in a position...');
        const allLotIds = Array.from(new Set([
            ...directLots.map(l => l.id),
            ...lotItems.map(li => li.lot_id)
        ]));

        if (allLotIds.length > 0) {
            // Batch query positions
            const lotIdList = `(${allLotIds.slice(0, 100).join(',')})`;
            const positions = await request(`/positions?lot_id=in.${lotIdList}&select=id,code,system_type`);
            console.log(`Found ${positions.length} lots assigned to positions.`);
            if (positions.length > 0) {
                console.log('Sample positions:', JSON.stringify(positions.slice(0, 5), null, 2));
            }
        }

        // 4. Warehouse name check
        const distinctWarehouses = await request('/lots?select=warehouse_name');
        const warehouseNames = new Set(distinctWarehouses.map(l => l.warehouse_name));
        console.log('\nDistinct warehouse names in lots table:', Array.from(warehouseNames));

    } catch (e) {
        console.error(e.message);
    }
}

run();
