
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLot() {
    console.log('Searching for lot: DL-LOT-070526-030...')
    const { data, error } = await supabase
        .from('lots')
        .select('*')
        .eq('code', 'DL-LOT-070526-030')
    
    if (error) {
        console.error('Error:', error)
        return
    }

    if (!data || data.length === 0) {
        console.log('Lot not found with code DL-LOT-070526-030')
        // Try searching with ilike just in case
        const { data: data2 } = await supabase
            .from('lots')
            .select('*')
            .ilike('code', '%070526-030%')
        console.log('Search with ilike result:', data2)
        return
    }

    console.log('Lot details:', JSON.stringify(data[0], null, 2))
}

checkLot()
