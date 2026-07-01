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
  console.log("=== CHECK POLICIES FOR POSITIONS ===");
  const { data: policies, error } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'positions');
  
  if (error) {
    // Nếu không select được pg_policies qua table, ta chạy rpc hoặc raw sql nếu có sql client,
    // nhưng pg_policies là view hệ thống, có thể supabase không cho phép select trực tiếp nếu không qua RPC.
    // Thử dùng query sql thông qua một cách khác: chạy RPC hoặc pg_policies
    console.error("Lỗi select pg_policies:", error);
  } else {
    console.log("Policies:", JSON.stringify(policies, null, 2));
  }

  // Thay vì pg_policies, ta cũng có thể truy vấn thử bằng cách tạo một JWT giả lập cho user
  // hoặc kiểm tra xem cột company_id của positions hiện tại như thế nào.
  // Hãy select toàn bộ positions có code là 'K1D1C12T402'
  const { data: pos } = await supabase
    .from('positions')
    .select('*')
    .eq('code', 'K1D1C12T402');
  console.log("Position K1D1C12T402 in DB:", JSON.stringify(pos, null, 2));
}

main();
