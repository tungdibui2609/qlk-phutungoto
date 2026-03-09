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
        const pid = '37a70183-f368-450a-867c-9b78119ae464';
        console.log(`Checking lots and positions for Product ID: ${pid}`);

        // 1. Get all lots for this product (direct or via items)
        const lots = await request(`/lots?product_id=eq.${pid}&select=id,code,warehouse_name,system_code`);
        const lotItems = await request(`/lot_items?product_id=eq.${pid}&select=lot_id`);

        const allLotIds = new Set(lots.map(l => l.id));
        lotItems.forEach(li => allLotIds.add(li.lot_id));

        console.log(`Total lots associated with this product: ${allLotIds.size}`);

        if (allLotIds.size > 0) {
            const lotIdArray = Array.from(allLotIds);
            const lotIdList = `(${lotIdArray.join(',')})`;

            // 2. Check position_id directly in lots (just in case)
            // Wait, looking at database.types.ts earlier, positions table has lot_id.

            // 3. Check positions where lot_id is one of these
            const positions = await request(`/positions?lot_id=in.${lotIdList}&select=id,code,lot_id,system_type`);
            console.log(`Lots assigned to positions: ${positions.length}`);

            positions.forEach(pos => {
                console.log(`- Position: ${pos.code}, LotID: ${pos.lot_id}, System: ${pos.system_type}`);
            });

            // 4. Check if there's a join table like zone_positions or something?
            // Earlier view of useWarehouseData used zpLookup from fetchAllZonesPos.
            // Let's check zone_positions table if it exists
            try {
                const zp = await request(`/zone_positions?select=position_id,zone_id&range=0-10`);
                console.log(`Sample zone_positions found.`);
            } catch (e) {
                console.log('zone_positions table does not exist or error.');
            }

            // 5. Check lots without positions
            const assignedLotIds = new Set(positions.map(p => p.lot_id));
            const unassignedLots = lotIdArray.filter(id => !assignedLotIds.has(id));

            console.log(`\nUnassigned lots count: ${unassignedLots.length}`);
            if (unassignedLots.length > 0) {
                const sampleUnassigned = await request(`/lots?id=in.(${unassignedLots.slice(0, 5).join(',')})&select=code,warehouse_name`);
                console.log('Sample unassigned lots:', sampleUnassigned);
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
