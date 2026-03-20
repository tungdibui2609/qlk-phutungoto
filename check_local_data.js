const postgres = require('postgres');
const sql = postgres('postgres://postgres:Tung210359@@localhost:5432/qlk_phutungoto');

async function checkData() {
    try {
        console.log('--- COMPANIES ---');
        const companies = await sql`SELECT id, name, code FROM public.companies`;
        console.table(companies);

        console.log('\n--- USER PROFILES ---');
        const profiles = await sql`SELECT id, email, full_name, company_id FROM public.user_profiles LIMIT 5`;
        console.table(profiles);

        console.log('\n--- SYSTEM CODES ---');
        const systems = await sql`SELECT code, name FROM public.systems`;
        console.table(systems);

    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        await sql.end();
    }
}

checkData();
