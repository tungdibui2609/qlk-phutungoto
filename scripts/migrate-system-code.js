// Migration script to add system_code to suppliers, vehicles, and customers
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    console.log('Starting migration...');

    try {
        // Add system_code column to suppliers
        console.log('Adding system_code to suppliers...');
        const { error: error1 } = await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS system_code TEXT REFERENCES systems(code)'
        });
        if (error1) console.log('Suppliers column might already exist:', error1.message);

        // Add system_code column to vehicles  
        console.log('Adding system_code to vehicles...');
        const { error: error2 } = await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS system_code TEXT REFERENCES systems(code)'
        });
        if (error2) console.log('Vehicles column might already exist:', error2.message);

        // Add system_code column to customers
        console.log('Adding system_code to customers...');
        const { error: error3 } = await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE customers ADD COLUMN IF NOT EXISTS system_code TEXT REFERENCES systems(code)'
        });
        if (error3) console.log('Customers column might already exist:', error3.message);

        // Update existing records
        console.log('Updating existing suppliers...');
        await supabase.from('suppliers').update({ system_code: 'FROZEN' }).is('system_code', null);

        console.log('Updating existing vehicles...');
        await supabase.from('vehicles').update({ system_code: 'FROZEN' }).is('system_code', null);

        console.log('Updating existing customers...');
        await supabase.from('customers').update({ system_code: 'FROZEN' }).is('system_code', null);

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
