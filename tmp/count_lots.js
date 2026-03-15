const https = require('https');

const API_URL = 'viqeyhpnevxcowsffueb.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

async function request(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_URL, port: 443, path: '/rest/v1' + path, method: 'GET',
            headers: { 'apikey': API_KEY, 'Authorization': `Bearer ${API_KEY}`, 'Prefer': 'count=exact' }
        };
        const req = https.request(options, (res) => {
            let data = '';
            // We just need the count from Content-Range header
            const range = res.headers['content-range'];
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ data: JSON.parse(data), count: range ? parseInt(range.split('/')[1]) : 0 });
                } else { reject(new Error(`Status: ${res.statusCode}`)); }
            });
        });
        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function run() {
    try {
        const { count } = await request('/lots?status=eq.active&system_code=eq.KHO_DONG_LANH&select=id&limit=1');
        console.log(`Total active lots in KHO_DONG_LANH: ${count}`);
    } catch (e) { console.error('Error:', e.message); }
}
run();
