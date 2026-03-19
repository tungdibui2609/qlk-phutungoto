import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugData() {
  try {
    // 1. Find Kho 3 / Sảnh 3
    const { data: zones, error: zoneError } = await supabase.from('zones').select('*')
    if (zoneError) throw zoneError

    const kho3 = zones?.find(z => z.name.includes('3') && z.parent_id === null)
    const sảnh3 = zones?.find(z => (z.name.includes('3') || z.code?.includes('3')) && z.is_hall)

    console.log('Kho 3 ID:', kho3?.id, 'Name:', kho3?.name)
    console.log('Sảnh 3 ID:', sảnh3?.id, 'Name:', sảnh3?.name)

    // 2. Count lots
    const { count: totalLots, error: countError } = await supabase.from('lots').select('*', { count: 'exact', head: true })
    if (countError) throw countError
    console.log('Total Lots in DB:', totalLots)

    // 3. Find assigned lot IDs from positions
    const { data: positions, error: posError } = await supabase.from('positions').select('lot_id').not('lot_id', 'is', null)
    if (posError) throw posError
    const assignedLotIds = new Set(positions?.map(p => p.lot_id))
    console.log('Assigned Lots in Positions:', assignedLotIds.size)

    // 4. Find unassigned lots
    console.log('Scanning for unassigned lots...')
    let unassignedLots = []
    let from = 0
    const step = 1000
    let hasMore = true

    while (hasMore) {
        const { data: lotsBatch, error: batchError } = await supabase.from('lots').select('id, code, created_at').range(from, from + step - 1)
        if (batchError) throw batchError
        if (!lotsBatch || lotsBatch.length === 0) {
            hasMore = false
            break
        }
        for (const lot of lotsBatch) {
            if (!assignedLotIds.has(lot.id)) {
                unassignedLots.push(lot)
            }
        }
        if (lotsBatch.length < step) hasMore = false
        from += step
    }

    console.log(`Summary: Found ${unassignedLots.length} unassigned lots.`)
    
    // Sort by created_at desc to find RECENTLY lost ones
    unassignedLots.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    console.log('Top 20 most recently unassigned lots:')
    unassignedLots.slice(0, 20).forEach(l => {
        console.log(`- ${l.code} (Created: ${l.created_at})`)
    })

    if (unassignedLots.length > 0) {
        // Find if these lots have items
        const ids = unassignedLots.map(l => l.id)
        const { data: items } = await supabase.from('lot_items').select('lot_id, quantity').in('lot_id', ids.slice(0, 100))
        console.log('\nItems found in these lost lots (sample):', items?.length || 0)
    }

  } catch (err) {
    console.error('DEBUG ERROR:', err)
  }
}

debugData()
