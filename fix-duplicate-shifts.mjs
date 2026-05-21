import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function fixDuplicates() {
    console.log('Checking for open shifts...')
    const { data: shifts, error } = await supabase
        .from('delivery_shifts')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching shifts:', error)
        return
    }

    console.log(`Found ${shifts.length} open shifts total.`)

    // Group by company_id + system_code
    const groups = {}
    for (const shift of shifts) {
        const key = `${shift.company_id}_${shift.system_code}`
        if (!groups[key]) groups[key] = []
        groups[key].push(shift)
    }

    for (const [key, group] of Object.entries(groups)) {
        if (group.length > 1) {
            console.log(`Group ${key} has ${group.length} open shifts! Closing older ones...`)
            // Keep the last one, close the rest
            const toClose = group.slice(0, group.length - 1)
            for (const shift of toClose) {
                console.log(`Closing shift ${shift.id}...`)
                const { error: updateError } = await supabase
                    .from('delivery_shifts')
                    .update({ status: 'closed', notes: 'Closed automatically by system due to duplicate open shifts bug' })
                    .eq('id', shift.id)
                if (updateError) {
                    console.error(`Failed to close shift ${shift.id}:`, updateError)
                } else {
                    console.log(`Successfully closed shift ${shift.id}`)
                }
            }
        } else {
            console.log(`Group ${key} is fine (1 open shift).`)
        }
    }
}

fixDuplicates().catch(console.error)
