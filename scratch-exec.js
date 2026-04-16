const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function main() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_APP_URL';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_APP_KEY';
    // Đọc env file nếu cần
    const envData = fs.readFileSync('.env.local', 'utf8');
    const urlMatch = envData.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    const keyMatch = envData.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || envData.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
    
    const url = urlMatch ? urlMatch[1].trim() : supabaseUrl;
    const key = keyMatch ? keyMatch[1].trim() : supabaseKey;

    const supabase = createClient(url, key);

    // Dùng chức năng raw RPC hoặc thử tạo migration. Thường chỉ có thể dùng SQL API qua rpc.
    console.log("Adding exported_quantity to export_task_items...");
    const { data, error } = await supabase.rpc('execute_sql', { 
        sql_query: 'ALTER TABLE public.export_task_items ADD COLUMN IF NOT EXISTS exported_quantity NUMERIC;'
    });
    
    if (error) {
        console.error("RPC Error:", error);
    } else {
        console.log("Success:", data);
    }
}

main().catch(console.error);
