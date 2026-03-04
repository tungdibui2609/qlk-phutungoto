const url = 'https://viqeyhpnevxcowsffueb.supabase.co/rest/v1/inbound_orders?select=code&order=created_at.desc&limit=5';
const headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U'
};

async function run() {
    try {
        const r1 = await fetch(url, { headers });
        const d1 = await r1.json();
        console.log('--- INBOUND ---');
        console.log(JSON.stringify(d1, null, 2));

        const urlOut = 'https://viqeyhpnevxcowsffueb.supabase.co/rest/v1/outbound_orders?select=code&order=created_at.desc&limit=5';
        const r2 = await fetch(urlOut, { headers });
        const d2 = await r2.json();
        console.log('--- OUTBOUND ---');
        console.log(JSON.stringify(d2, null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
