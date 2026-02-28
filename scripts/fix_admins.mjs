import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function fixAdmins() {
    console.log('Fetching admins needing fix...');

    const headers = {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };

    // Find users with permissions containing system.full_access
    // PostgREST syntax for contains: cs
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?permissions=cs.%7Bsystem.full_access%7D&account_level=is.null`, {
        headers
    });

    if (!res.ok) {
        console.error('Failed to fetch:', await res.text());
        return;
    }

    const profiles = await res.json();
    console.log(`Found ${profiles.length} admins needing fix.`);

    for (const profile of profiles) {
        console.log(`Updating ${profile.email}...`);
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${profile.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                account_level: 2,
                allowed_systems: ['ALL']
            })
        });

        if (!updateRes.ok) {
            console.error(`Error updating ${profile.email}:`, await updateRes.text());
        } else {
            console.log(`Successfully updated ${profile.email}`);
        }
    }
    console.log('Done!');
}

fixAdmins().catch(console.error);
