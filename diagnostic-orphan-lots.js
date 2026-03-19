import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function recoverData() {
  try {
    // 1. All lots in positions
    const { data: positions } = await supabase.from('positions').select('lot_id').not('lot_id', 'is', null)
    const assignedLotIds = new Set(positions?.map(p => p.lot_id))

    // 2. All lot IDs that have items (stock)
    const { data: itemLots } = await supabase.from('lot_items').select('lot_id, quantity')
    const lotsWithStock = new Set(itemLots?.filter(i => (i.quantity || 0) > 0).map(i => i.lot_id))

    console.log('Lots with positive stock:', lotsWithStock.size)

    // 3. Find lots with stock but NO position
    const orphanedLots = []
    const lotsWithStockArr = Array.from(lotsWithStock)
    
    // Batch query these lots to get codes
    for (let i = 0; i < lotsWithStockArr.length; i += 500) {
        const batchIds = lotsWithStockArr.slice(i, i + 500)
        const { data: lotsBatch } = await supabase.from('lots').select('id, code, created_at').in('id', batchIds)
        if (lotsBatch) {
            for (const lot of lotsBatch) {
                if (!assignedLotIds.has(lot.id)) {
                    orphanedLots.push(lot)
                }
            }
        }
    }

    console.log('Summary of orphaned lots (lots with items but no position):')
    console.log('Total orphaned:', orphanedLots.length)
    
    // Recent are likely the ones the user just lost
    orphanedLots.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    console.log('Detailed list (Top 40):')
    orphanedLots.slice(0, 40).forEach(l => {
        console.log(`- ${l.code} (ID: ${l.id}, Created: ${l.created_at})`)
    })

  } catch (err) {
    console.error(err)
  }
}

recoverData()
