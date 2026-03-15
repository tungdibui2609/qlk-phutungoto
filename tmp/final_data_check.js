const https = require('https');
const fs = require('fs');

const API_URL = 'viqeyhpnevxcowsffueb.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

async function request(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_URL, port: 443, path: '/rest/v1' + path, method: 'GET',
            headers: { 'apikey': API_KEY, 'Authorization': `Bearer ${API_KEY}` }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
                } else { reject(new Error(`Status: ${res.statusCode}, Data: ${data}`)); }
            });
        });
        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function run() {
    try {
        console.log('--- ALL SYSTEMS ---');
        const systems = await request('/systems?select=code,name');
        systems.forEach(s => console.log(`- ${s.code}: ${s.name}`));

        console.log('\n--- ACTIVE LOTS SUMMARY BY SYSTEM ---');
        const lots = await request('/lots?status=eq.active&select=system_code');
        const counts = {};
        lots.forEach(l => {
            const c = l.system_code || 'NULL';
            counts[c] = (counts[c] || 0) + 1;
        });
        Object.entries(counts).forEach(([sys, count]) => console.log(`- ${sys}: ${count} lots`));

        console.log('\n--- SAMPLE SẦU RIÊNG INVENTORY ---');
        // Get some lot items of durian
        const items = await request('/lot_items?select=lot_id,quantity,products(name,internal_name)&products.name=ilike.*Sầu riêng*&limit=10');
        for (const item of items) {
             const lot = await request(`/lots?id=eq.${item.lot_id}&select=code,status,system_code`);
             console.log(`- Lot: ${lot[0]?.code} | System: ${lot[0]?.system_code} | Status: ${lot[0]?.status} | Product: ${item.products.name} | Qty: ${item.quantity}`);
        }
    } catch (e) { console.error('Error:', e.message); }
}
run();
