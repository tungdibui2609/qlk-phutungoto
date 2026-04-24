
async function checkLots() {
    const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';
    
    const today = '230426';
    const prefix = `DL-LOT-${today}-`;
    console.log(`Checking lots with prefix: ${prefix}`);

    const url = `${supabaseUrl}/rest/v1/lots?code=ilike.${prefix}%25&select=code,system_code&order=code.desc&limit=10`;

    try {
        const response = await fetch(url, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Error fetching lots:', err);
            return;
        }

        const data = await response.json();
        console.log(`Found ${data.length} lots (top 10):`);
        data.forEach(l => console.log(`- ${l.code} (${l.system_code})`));
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

checkLots();
