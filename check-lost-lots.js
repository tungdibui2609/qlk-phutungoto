import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkLostLots() {
  // 1. Get all lot IDs from lots table
  const { data: allLots, error: lotsError } = await supabase
    .from('lots')
    .select('id, code')

  if (lotsError) {
    console.error('Error fetching lots:', lotsError)
    return
  }

  // 2. Get all assigned lot IDs from positions table
  const { data: assignedPositions, error: posError } = await supabase
    .from('positions')
    .select('lot_id')
    .not('lot_id', 'is', null)

  if (posError) {
    console.error('Error fetching positions:', posError)
    return
  }

  const assignedLotIds = new Set(assignedPositions.map(p => p.lot_id))

  // 3. Find lots not in any position
  const lostLots = allLots.filter(l => !assignedLotIds.has(l.id))

  console.log(`Summary:`)
  console.log(`Total Lots: ${allLots.length}`)
  console.log(`Assigned Lots: ${assignedLotIds.size}`)
  console.log(`Unassigned (Lost) Lots: ${lostLots.length}`)

  if (lostLots.length > 0) {
    console.log('\nList of Unassigned Lots:')
    lostLots.forEach(l => {
        console.log(`- ID: ${l.id}, Code: ${l.code || 'N/A'}`)
    })
  }
}

checkLostLots()
