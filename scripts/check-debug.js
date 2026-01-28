const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually load .env.local
try {
    const envPath = path.resolve(__dirname, '../.env.local');
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
    });
} catch (e) {
    console.warn('Could not load .env.local', e);
}

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

async function main() {
    console.log('--- CHECKING RECENT COMPANIES ---');
    const { data: companies, error: companyError } = await supabaseAdmin
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (companyError) console.error(companyError);
    else console.table(companies.map(c => ({ id: c.id, name: c.name, code: c.code, created: c.created_at })));

    console.log('\n--- CHECKING RECENT USER PROFILES ---');
    const { data: profiles, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false }) // user_profiles has created_at? Needs check.
        // If no created_at, we just list latest
        .limit(10);

    if (profileError) console.error(profileError);
    else console.table(profiles.map(p => ({ id: p.id, email: p.email, company_id: p.company_id, name: p.full_name })));

    console.log('\n--- CHECKING AUTH USERS (LAST 10) ---');
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 10,
        sortBy: { field: 'created_at', direction: 'desc' }
    });

    if (authError) console.error(authError);
    else console.table(users.map(u => ({ id: u.id, email: u.email, created: u.created_at, metadata: u.user_metadata })));
}

main();
