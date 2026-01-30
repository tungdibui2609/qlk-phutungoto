const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSystems() {
    const { data, error } = await supabase
        .from('systems')
        .select('id, name, modules')
        .not('modules', 'is', null)

    if (error) {
        console.error(error)
    } else {
        // Check if any row has 'pricing' in the array
        const hasPricing = data.some(row => {
            if (Array.isArray(row.modules)) {
                return row.modules.includes('pricing')
            }
            return false
        })
        console.log("Has Pricing?:", hasPricing)
        console.log(JSON.stringify(data, null, 2))
    }
}

checkSystems()
