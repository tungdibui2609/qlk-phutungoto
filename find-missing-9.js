import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function findTheNine() {
  try {
    // 1. Get all assigned lot IDs
    const { data: positions } = await supabase.from('positions').select('lot_id').not('lot_id', 'is', null)
    const assignedLotIds = new Set(positions?.map(p => p.lot_id))

    // 2. Find all lots that have warehouse_name related to '3' 
    // This is a guess that the column warehouse_name might contain 'KHO 3'
    const { data: lotsInKho3, error: lotError } = await supabase
        .from('lots')
        .select('id, code, warehouse_name, created_at')
        .filter('warehouse_name', 'ilike', '%3%')

    if (lotError) throw lotError

    console.log(`Found ${lotsInKho3.length} lots that have '3' in warehouse_name.`)
    
    const floatingInKho3 = lotsInKho3.filter(l => !assignedLotIds.has(l.id))
    console.log(`Of those, ${floatingInKho3.length} are currently NOT in any position.`)
    
    if (floatingInKho3.length > 0) {
        console.log('List of floating lots from Kho 3 (Potential candidates for the missing 9):')
        floatingInKho3.forEach(l => {
            console.log(`- ${l.code} (ID: ${l.id}, Created: ${l.created_at})`)
        })
    } else {
        // If that didn't work, maybe check for ANY unassigned lots updated today
        console.log('No unassigned lots found with warehouse_name containing "3". Checking all unassigned updated recently...')
        // Since we don't have updated_at, we use created_at as a proxy if they were imported today, 
        // OR we just find ALL unassigned and show the counts.
    }

  } catch (err) {
    console.error(err)
  }
}

findTheNine()
