import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkKho3() {
  try {
    const kho3Id = 'aed91a65-860d-478f-9f06-94ff1c4cd5ce'
    
    // 1. Get all zones
    const { data: zones } = await supabase.from('zones').select('id, name, parent_id')
    
    // 2. Find all descendants of Kho 3
    const descendants = new Set([kho3Id])
    let added = true
    while (added) {
        added = false
        for (const z of zones) {
            if (z.parent_id && descendants.has(z.parent_id) && !descendants.has(z.id)) {
                descendants.add(z.id)
                added = true
            }
        }
    }
    
    // 3. Find positions in these zones that HAVE lot_id
    const { data: occupiedInKho3 } = await supabase
        .from('positions')
        .select('id, code, lot_id, zone_id')
        .in('zone_id', Array.from(descendants))
        .not('lot_id', 'is', null)

    console.log(`Found ${occupiedInKho3?.length || 0} occupied positions remaining in Kho 3.`)
    if (occupiedInKho3 && occupiedInKho3.length > 0) {
        occupiedInKho3.forEach(p => {
            console.log(`- Position: ${p.code}, Lot ID: ${p.lot_id}`)
        })
    }
    
  } catch (err) {
    console.error(err)
  }
}

checkKho3()
