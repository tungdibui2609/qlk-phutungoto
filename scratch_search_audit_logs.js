const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

async function main() {
  console.log("=== TÌM KIẾM TRONG BẢNG audit_logs ===");
  try {
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .or('old_data.ilike.%L036%,new_data.ilike.%L036%');

    if (error) {
      console.log("Lỗi hoặc không có bảng audit_logs:", error.message);
      return;
    }

    console.log(`Tìm thấy ${logs ? logs.length : 0} log liên quan đến L036:`);
    logs?.forEach(l => {
      console.log({
        id: l.id,
        action: l.action,
        table_name: l.table_name,
        created_at: l.created_at,
        old_data: l.old_data,
        new_data: l.new_data
      });
    });
  } catch (e) {
    console.log("Không truy cập được audit_logs:", e.message);
  }
}

main();
