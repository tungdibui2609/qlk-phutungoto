
async function checkStatus() {
    const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';
    
    const today = '230426';
    const prefix = `DL-LOT-${today}-`;
    console.log(`Checking status for: ${prefix}`);

    const url = `${supabaseUrl}/rest/v1/lots?code=ilike.${prefix}%25&select=code&order=code.desc`;
    const response = await fetch(url, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const data = await response.json();
    console.log(`Lots for today:`, data.map(l => l.code));
}

checkStatus();
