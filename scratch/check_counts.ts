
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkCounts() {
    const { count: posCount } = await supabase.from('positions').select('*', { count: 'exact', head: true })
    const { count: assignmentCount } = await supabase.from('pending_assignments').select('*', { count: 'exact', head: true })
    const { count: lotCount } = await supabase.from('lots').select('*', { count: 'exact', head: true })

    console.log('Total Positions:', posCount)
    console.log('Total Pending Assignments:', assignmentCount)
    console.log('Total Lots:', lotCount)
}

checkCounts()
