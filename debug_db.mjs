
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
    console.log('Fetching lots and their tags...')
    const { data: lots, error } = await supabase
        .from('lots')
        .select(`
            id,
            code,
            status,
            system_code,
            warehouse_name,
            lot_items (
                id,
                product_id,
                quantity,
                unit
            ),
            lot_tags (
                tag,
                lot_item_id
            )
        `)

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log(`Found ${lots?.length || 0} lots.`)
    fs.writeFileSync('debug_lots.json', JSON.stringify(lots, null, 2))
    console.log('Results written to debug_lots.json')
}

debug()
