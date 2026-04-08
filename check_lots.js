const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    if (line.includes('=')) {
        const [key, ...val] = line.split('=');
        env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
    }
});

async function run() {
    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/lots?code=ilike.DL-LOT-040426-125%25&select=id,code,daily_seq,production_code,status`;
    const res = await fetch(url, {
        headers: {
            'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}
run();
