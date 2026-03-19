import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function findLostLots() {
  try {
    // 1. Get all system codes
    const { data: systems } = await supabase.from('systems').select('code')
    const systemCodes = systems?.map(s => s.code) || ['KHO_DONG_LANH', 'FROZEN', 'DRY']

    console.log('Systems found:', systemCodes)

    for (const code of systemCodes) {
        console.log(`Checking system: ${code}`)
        const { data: unassigned, error } = await supabase.rpc('get_unassigned_lots', { p_system_code: code })
        if (error) {
            console.error(`Error for ${code}:`, error.message)
            continue
        }
        
        if (unassigned && unassigned.length > 0) {
            console.log(`- Found ${unassigned.length} unassigned lots in ${code}`)
            // Sort by created_at desc
            unassigned.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            console.log('Detail (Top 30):')
            unassigned.slice(0, 30).forEach(l => {
                console.log(`  * ${l.code} (Created: ${l.created_at})`)
            })
        } else {
            console.log(`- No unassigned lots in ${code}`)
        }
    }

  } catch (err) {
    console.error(err)
  }
}

findLostLots()
