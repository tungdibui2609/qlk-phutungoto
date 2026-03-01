const fs = require('fs');
const url = 'https://viqeyhpnevxcowsffueb.supabase.co/rest/v1/lots?select=id,code,status,system_code,positions(id,code)&status=in.(active,in_stock)';
const headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U'
};

fetch(url, { headers })
    .then(r => r.json())
    .then(data => {
        // Mimic app logic
        const trulyUnassigned = data.filter(l => !l.positions || l.positions.length === 0);
        fs.writeFileSync('count_result.txt', `Total fetched: ${data.length}\nTruly unassigned count: ${trulyUnassigned.length}\nSample Codes: ${trulyUnassigned.slice(0, 5).map(x => x.code).join(', ')}`, 'utf8');
    })
    .catch(console.error);
