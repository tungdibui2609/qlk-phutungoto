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
        console.log('--- CHECKING PRODUCTS CONTAINING "Sầu riêng" ---');
        const searchVal = encodeURIComponent('ilike.*Sầu riêng*');
        const products = await request(`/products?name=${searchVal}&select=id,name,unit,internal_code,internal_name`);
        console.log(`Found ${products.length} products.`);
        products.forEach(p => {
            console.log(`- ID: ${p.id} | Name: ${p.name} | Base Unit: ${p.unit} | Internal Name: ${p.internal_name}`);
        });

        if (products.length > 0) {
            const pids = products.map(p => p.id);
            console.log('\n--- CHECKING PRODUCT UNITS ---');
            const idsParam = encodeURIComponent(`in.(${pids.join(',')})`);
            const prodUnits = await request(`/product_units?product_id=${idsParam}&select=product_id,unit_id,conversion_rate,units(name)`);
            prodUnits.forEach(pu => {
                console.log(`- ProductID: ${pu.product_id} | Unit: ${pu.units?.name} | Rate: ${pu.conversion_rate}`);
            });
        }
        
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
