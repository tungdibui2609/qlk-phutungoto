import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    // Just fetch zones and try inserting two identical codes
    console.log("Fetching zones to check constraints or issues...")
    // Actually let's just query the pg_class/pg_index if we have admin rights, but we only have anon key probably.
    const { data: cols } = await supabase.rpc('get_table_info', { table_name: 'zones' })
    console.log(cols)
}

test()
