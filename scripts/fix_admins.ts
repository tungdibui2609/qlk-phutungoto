import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

async function fixAdmins() {
    console.log('Fixing existing admins with system.full_access...')

    // Find users with permissions containing system.full_access
    const { data: profiles, error } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .contains('permissions', ['system.full_access'])
        .is('account_level', null)

    if (error) {
        console.error('Error fetching profiles:', error)
        return
    }

    console.log(`Found ${profiles?.length || 0} admins needing fix.`)

    if (profiles && profiles.length > 0) {
        for (const profile of profiles) {
            console.log(`Updating ${profile.email}...`)
            const { error: updateError } = await supabaseAdmin
                .from('user_profiles')
                .update({ account_level: 2, allowed_systems: ['ALL'] })
                .eq('id', profile.id)

            if (updateError) {
                console.error(`Error updating ${profile.email}:`, updateError)
            } else {
                console.log(`Successfully updated ${profile.email}`)
            }
        }
    }
    console.log('Done!')
}

fixAdmins()
