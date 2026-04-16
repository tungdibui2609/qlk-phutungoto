const https = require('https');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const sql = `ALTER TABLE "public"."export_task_items" ADD COLUMN IF NOT EXISTS "exported_quantity" numeric;`;

const body = JSON.stringify({ query: sql });

const url = new URL(SUPABASE_URL + '/rest/v1/rpc/');
// Use the SQL endpoint via pg_net or direct REST. Supabase provides /pg endpoint for service role.
// Actually, let's use the Supabase Management API or direct SQL via PostgREST rpc

// Simplest approach: use fetch with the SQL API
const postData = JSON.stringify({ query: sql });

const options = {
    hostname: 'viqeyhpnevxcowsffueb.supabase.co',
    path: '/rest/v1/rpc/execute_sql',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
        if (res.statusCode >= 400) {
            console.log('\nRPC not available. Please run this SQL manually in Supabase Dashboard > SQL Editor:');
            console.log(sql);
        }
    });
});

req.on('error', (e) => {
    console.error('Error:', e.message);
    console.log('\nPlease run this SQL manually in Supabase Dashboard > SQL Editor:');
    console.log(sql);
});

req.write(postData);
req.end();
