
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) env[key.trim()] = val.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSystems() {
    console.log("Checking Systems...");
    const { data, error } = await supabase.from('systems').select('*');
    if (error) {
        console.error("Error:", error);
        return;
    }
    data.forEach(sys => {
        console.log(`System: ${sys.code}`);
        console.log(`Type of inbound_modules: ${typeof sys.inbound_modules}`);
        console.log(`Value of inbound_modules:`, JSON.stringify(sys.inbound_modules));
        if (sys.modules) {
            console.log(`Value of modules (legacy):`, JSON.stringify(sys.modules));
        }
        console.log('---');
    });
}

checkSystems();
