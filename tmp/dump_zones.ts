
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function dumpZones() {
    const { data: zones, error } = await supabase
        .from('zones')
        .select('*')
        .eq('system_type', 'KHO_DONG_LANH')
        .order('level')
        .order('display_order')
    
    if (error) {
        console.error(error)
        return
    }

    console.log(JSON.stringify(zones, null, 2))
}

dumpZones()
