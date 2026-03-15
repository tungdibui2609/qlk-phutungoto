const https = require('https');

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
                } else { reject(new Error(`Status: ${res.statusCode}`)); }
            });
        });
        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function run() {
    try {
        console.log('--- TABLES CHECK ---');
        // Check categories table
        const categories = await request('/categories?select=id,name&limit=5');
        console.log('Categories sample:', categories);

        // Check if products have category_id or if there is a rel table
        const productSample = await request('/products?select=id,name,category_id&limit=1');
        console.log('Product sample:', productSample);

        // Check for product_category_rel or similar
        try {
            const relSample = await request('/product_category_rel?select=*&limit=1');
            console.log('product_category_rel sample:', relSample);
        } catch (e) {
            console.log('No product_category_rel table found or error.');
        }

    } catch (e) { console.error('Error:', e.message); }
}
run();
