import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSystems() {
    const { data, error } = await supabase
        .from('systems')
        .select('id, name, modules')
        .not('modules', 'is', null)
        .limit(5)

    if (error) {
        console.error(error)
    } else {
        console.log(JSON.stringify(data, null, 2))
    }
}

checkSystems()
