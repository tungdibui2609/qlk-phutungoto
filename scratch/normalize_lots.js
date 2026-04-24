
async function normalizeLots() {
    const supabaseUrl = 'https://viqeyhpnevxcowsffueb.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';
    
    // Find lots that might be unpadded. 
    // We check for codes ending in -X or -XX
    console.log(`Searching for unpadded lots...`);

    const { data: allLots, error: fetchError } = await fetch(`${supabaseUrl}/rest/v1/lots?select=id,code`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    }).then(res => res.json().then(data => ({ data, error: !res.ok ? data : null })));

    if (fetchError) {
        console.error('Error fetching lots:', fetchError);
        return;
    }

    const unpadded = allLots.filter(l => {
        const parts = l.code.split('-');
        const lastPart = parts[parts.length - 1];
        return /^\d+$/.test(lastPart) && lastPart.length < 3;
    });

    console.log(`Found ${unpadded.length} unpadded lots.`);

    for (const lot of unpadded) {
        const parts = lot.code.split('-');
        const lastPart = parts[parts.length - 1];
        const paddedPart = lastPart.padStart(3, '0');
        const newCode = [...parts.slice(0, -1), paddedPart].join('-');
        
        console.log(`Normalizing: ${lot.code} -> ${newCode}`);

        const updateRes = await fetch(`${supabaseUrl}/rest/v1/lots?id=eq.${lot.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ code: newCode })
        });

        if (!updateRes.ok) {
            console.error(`Failed to update ${lot.code}:`, await updateRes.text());
        }
    }
    console.log('Normalization complete.');
}

normalizeLots();
