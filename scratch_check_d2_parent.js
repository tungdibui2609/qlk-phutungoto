const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    try {
        const { data: zones, error } = await supabase
            .from('zones')
            .select('*')
            .in('id', [
                '81c4414a-43f6-454d-9a10-a34b341a99c5',
                'aed91a65-860d-478f-9f06-94ff1c4cd5ce'
            ]);

        if (error) {
            console.error(error);
            return;
        }

        console.log(JSON.stringify(zones, null, 2));

    } catch (e) {
        console.error(e);
    }
}

main();
