import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanUp() {
    console.log('Fetching old zones...');
    const { data, error } = await supabase.from('zones').select('id, name, code').in('name', ['Vị trí Sơ đồ 2D', 'KHO DỤNG CỤ']);
    if (error) {
        console.error('Error fetching:', error);
        return;
    }
    console.log('Found zones:', data);

    for (const zone of data || []) {
        console.log(`Deleting ${zone.name}...`);
        // Note: zone_positions and positions might have FK constraints.
        // We might just rename them or mark them inactive, but since this is dev, we can try to delete.
        const { error: delErr } = await supabase.from('zones').delete().eq('id', zone.id);
        if (delErr) {
             console.error('Delete error for', zone.name, delErr);
        } else {
             console.log('Deleted', zone.name);
        }
    }
}

cleanUp();
