const fs = require('fs');
const dotenvContent = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = dotenvContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = dotenvContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function cleanUp() {
    console.log('Fetching old zones...');
    const res = await fetch(`${supabaseUrl}/rest/v1/zones?name=in.(Vị trí Sơ đồ 2D,KHO DỤNG CỤ)&select=id,name`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const data = await res.json();
    console.log('Found zones:', data);

    for (const zone of data || []) {
        console.log(`Deleting ${zone.name}...`);
        const delRes = await fetch(`${supabaseUrl}/rest/v1/zones?id=eq.${zone.id}`, {
            method: 'DELETE',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        if (!delRes.ok) {
             console.error('Delete error for', zone.name, await delRes.text());
        } else {
             console.log('Deleted', zone.name);
        }
    }
}

cleanUp();
