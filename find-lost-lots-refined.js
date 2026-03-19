import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function findLostLots() {
  try {
    // 1. Get all lot IDs currently in any position
    const { data: positions } = await supabase.from('positions').select('lot_id').not('lot_id', 'is', null)
    const assignedLotIds = new Set(positions?.map(p => p.lot_id))

    // 2. Query lots that were updated TODAY and are NOT in any position
    // We'll also check for lots that were specifically in Sảnh 3 before (if we had history, but we don't, 
    // so we look for recently active lots).
    const today = new Date().toISOString().split('T')[0]
    
    const { data: lostLots, error: lotError } = await supabase
        .from('lots')
        .select('id, code, updated_at, created_at')
        .gte('updated_at', today)
        .order('updated_at', { ascending: false })

    if (lotError) throw lotError

    const actualLostRows = lostLots.filter(l => !assignedLotIds.has(l.id))

    console.log(`Found ${actualLostRows.length} lost lots updated today.`)
    console.log(JSON.stringify(actualLostRows.slice(0, 50), null, 2))

  } catch (err) {
    console.error(err)
  }
}

findLostLots()
