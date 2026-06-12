const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    envVars[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function checkSystems() {
    console.log('Fetching systems from DB...');
    try {
        const { data, error } = await supabase
            .from('systems')
            .select('*');

        if (error) {
            console.error('Error fetching systems:', error);
            return;
        }

        console.log('Systems in DB:');
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Exception:', e);
    }
}

checkSystems();
