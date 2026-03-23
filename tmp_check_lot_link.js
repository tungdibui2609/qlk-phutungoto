const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findLotInfo() {
    const lotSearch = '260';
    console.log(`Searching for lots containing: ${lotSearch}`);

    const { data: lots } = await supabase
        .from('lots')
        .select('*, productions(*)')
        .ilike('code', `%${lotSearch}%`);
    
    if (lots && lots.length > 0) {
        console.log(`Found ${lots.length} lots.`);
        lots.forEach(l => {
            console.log(`Lot ID: ${l.id} | Code: [${l.code}] | Production ID: ${l.production_id}`);
        });
    } else {
        console.log(`No lot found with code containing: ${lotSearch}`);
    }
}

findLotInfo();
