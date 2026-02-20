import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    const { data, error } = await supabase
        .from('export_task_items')
        .select(`
        id,
        task_id,
        position_id,
        positions (code)
    `)
        .eq('task_id', '66ac3079-6f20-46a9-abbe-c34ccdea39dc')

    console.log(JSON.stringify({ data, error }, null, 2))
}

test()
