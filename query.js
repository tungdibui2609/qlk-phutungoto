const fs = require('fs');
const https = require('https');

// Parse .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
        env[key.trim()] = values.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/fresh_material_stage_outputs?select=*';
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

https.get(url, {
    headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('--- OUTPUTS ---');
        console.log(data);
    });
}).on('error', err => console.error(err));
