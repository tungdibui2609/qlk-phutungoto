const https = require('https');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const sql = `
ALTER TABLE "public"."pending_assignments" ADD COLUMN IF NOT EXISTS "lot_id" uuid REFERENCES lots(id);
ALTER TABLE "public"."pending_assignments" ADD COLUMN IF NOT EXISTS "assignment_type" text;
ALTER TABLE "public"."pending_assignments" ADD COLUMN IF NOT EXISTS "old_position_code" text;
`;

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
    });
});

req.on('error', (e) => {
    console.error('Error:', e.message);
});

req.write(postData);
req.end();
