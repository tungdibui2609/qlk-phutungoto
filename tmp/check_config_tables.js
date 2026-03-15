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
                } else { resolve(null); }
            });
        });
        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function run() {
    try {
        console.log('--- CHECKING PERSISTENT CONFIG TABLES ---');
        const tables = ['user_preferences', 'user_settings', 'system_settings', 'app_config'];
        for (const t of tables) {
            const result = await request(`/${t}?limit=1`);
            console.log(`Table ${t}:`, result ? 'Exists' : 'Not found');
        }
    } catch (e) { console.error('Error:', e.message); }
}
run();
