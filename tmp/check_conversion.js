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
    try {
        const pid = 'b406fdcc-da1e-407f-8209-1153ea73d798'; // Dona/Monthong C kem
        output += `--- CHECKING PRODUCT UNITS for ${pid} ---\n`;
        const pUnits = await request(`/product_units?product_id=eq.${pid}&select=unit_id,conversion_rate`);
        
        output += '\n--- FETCHING ALL UNITS ---\n';
        const units = await request('/units?select=id,name');
        const unitMap = {};
        units.forEach(u => unitMap[u.id] = u.name);

        pUnits.forEach(pu => {
            output += `- Unit: ${unitMap[pu.unit_id]} | Rate: ${pu.conversion_rate}\n`;
        });

        output += '\n--- CHECKING KG UNIT DEFINITION ---\n';
        units.forEach(u => {
            const low = u.name.toLowerCase().trim();
            if (['kg', 'kilogram', 'ki-lo-gam', 'kgs'].includes(low)) {
                output += `- MATCH FOUND: ${u.name} (ID: ${u.id})\n`;
            }
        });
        
        fs.writeFileSync('d:\\toanthang\\web\\tmp\\conversion_result.txt', output, 'utf8');
        console.log('Done');
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
