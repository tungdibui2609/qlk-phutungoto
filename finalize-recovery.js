import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function finalize() {
  try {
    // 1. Find Kho 4 and its Sảnh
    const { data: zones } = await supabase.from('zones').select('id, name, parent_id, is_hall')
    const kho4 = zones?.find(z => z.name.includes('4') && z.parent_id === null)
    const halls4 = zones?.filter(z => z.name.includes('4') && z.is_hall)

    console.log('Kho 4 ID:', kho4?.id, 'Name:', kho4?.name)
    console.log('Halls in Kho 4:')
    halls4?.forEach(h => console.log(`- ID: ${h.id}, Name: ${h.name}`))

    // 2. Identify the 10 orphans again (just to be sure)
    let assignedLotIds = new Set()
    let fromPos = 0
    let stepPos = 1000
    while (true) {
        const { data: posBatch } = await supabase.from('positions').select('lot_id').not('lot_id', 'is', null).range(fromPos, fromPos + stepPos - 1)
        if (!posBatch || posBatch.length === 0) break
        posBatch.forEach(p => assignedLotIds.add(p.lot_id))
        if (posBatch.length < stepPos) break
        fromPos += stepPos
    }

    let lotsWithStock = new Set()
    let fromItem = 0
    let stepItem = 1000
    while (true) {
        const { data: itemBatch } = await supabase
            .from('lot_items')
            .select('lot_id, quantity, lots!inner(system_code)')
            .eq('lots.system_code', 'KHO_DONG_LANH')
            .range(fromItem, fromItem + stepItem - 1)
        
        if (!itemBatch || itemBatch.length === 0) break
        itemBatch.forEach(i => { if ((i.quantity || 0) > 0) lotsWithStock.add(i.lot_id) })
        if (itemBatch.length < stepItem) break
        fromItem += stepItem
    }

    const orphanedLots = []
    const lotsWithStockArr = Array.from(lotsWithStock)
    for (let i = 0; i < lotsWithStockArr.length; i += 500) {
        const batchIds = lotsWithStockArr.slice(i, i + 500)
        const { data: lotsBatch } = await supabase.from('lots').select('id, code').in('id', batchIds)
        if (lotsBatch) {
            for (const lot of lotsBatch) {
                if (!assignedLotIds.has(lot.id)) {
                    orphanedLots.push(lot)
                }
            }
        }
    }

    console.log(`Final Orphan Count: ${orphanedLots.length}`)
    if (orphanedLots.length > 0) {
        console.log('Orphaned Lots to Recover:')
        orphanedLots.forEach(l => console.log(`- ${l.code} (${l.id})`))
    }

  } catch (err) {
    console.error(err)
  }
}

finalize()
