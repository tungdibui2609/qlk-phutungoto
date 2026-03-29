import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function test() {
    console.log("TESTING BATCHES");
    const { data: batches } = await supabase.from('fresh_material_batches').select('id, batch_code, document_urls').order('created_at', { ascending: false }).limit(2);
    console.log(JSON.stringify(batches, null, 2));
    
    console.log("TESTING RECEIVINGS");
    const { data: recs } = await supabase.from('fresh_material_receivings').select('id, document_urls').order('created_at', { ascending: false }).limit(2);
    console.log(JSON.stringify(recs, null, 2));

    console.log("TESTING STAGES");
    const { data: stages } = await supabase.from('fresh_material_stages').select('id, document_urls').order('created_at', { ascending: false }).limit(2);
    console.log(JSON.stringify(stages, null, 2));
}

test()
