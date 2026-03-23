const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Try to load env from .env or .env.local
let env = {};
try {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) env[key.trim()] = value.trim();
    });
} catch (e) {}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyView() {
    console.log('Verifying all production stats...');
    const { data, error } = await supabase
        .from('production_item_statistics')
        .select('*')
        .limit(5);
    
    if (error) {
        console.error('Error fetching view:', error);
        return;
    }

    if (data) {
        console.log('Sample data from view:', JSON.stringify(data, null, 2));
    }
}

verifyView();
