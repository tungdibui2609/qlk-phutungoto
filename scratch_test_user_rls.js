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

const adminSupabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log("=== BẮT ĐẦU TEST RLS VỚI USER THƯỜNG ===");
  const testEmail = `test_rls_user_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const companyId = 'b503014d-19b6-464e-91f3-f34eba4b4b05'; // Chánh Thu

  // 1. Tạo user test bằng admin
  const { data: authData, error: createErr } = await adminSupabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { company_id: companyId }
  });

  if (createErr) {
    console.error("Lỗi tạo user test:", createErr);
    return;
  }

  const userId = authData.user.id;
  console.log(`Đã tạo thành công user test. ID: ${userId}, Email: ${testEmail}`);

  try {
    // 2. Đăng nhập bằng user test bằng client anon bình thường
    const clientSupabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: loginData, error: loginErr } = await clientSupabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (loginErr) {
      console.error("Lỗi đăng nhập user test:", loginErr);
      return;
    }

    console.log("Đăng nhập thành công với session JWT.");

    // 3. Chạy query select positions có code là 'K1D1C12T402'
    const { data: posDirect, error: posErr } = await clientSupabase
      .from('positions')
      .select('*')
      .eq('code', 'K1D1C12T402');

    console.log("--- QUERY DIRECT POSITIONS (User thường) ---");
    if (posErr) console.error("Lỗi query direct positions:", posErr);
    else console.log("Kết quả positions trực tiếp:", JSON.stringify(posDirect, null, 2));

    // 4. Chạy query select lots join positions cho lot 'DL-LOT-290626-200281'
    const { data: lotJoin, error: lotErr } = await clientSupabase
      .from('lots')
      .select('id, code, positions!positions_lot_id_fkey(id, code, company_id)')
      .eq('code', 'DL-LOT-290626-200281');

    console.log("--- QUERY LOT JOIN POSITIONS (User thường) ---");
    if (lotErr) console.error("Lỗi query lot join:", lotErr);
    else console.log("Kết quả lot join:", JSON.stringify(lotJoin, null, 2));

    // 5. Chạy RPC get_unassigned_lots
    const { data: unassigned, error: rpcErr } = await clientSupabase
      .rpc('get_unassigned_lots', { p_system_code: 'KHO_DONG_LANH' });

    console.log("--- RPC GET_UNASSIGNED_LOTS (User thường) ---");
    if (rpcErr) console.error("Lỗi gọi RPC:", rpcErr);
    else {
      const isFound = unassigned.some(l => l.code === 'DL-LOT-290626-200281');
      console.log("Tổng số lot chưa gán trả về:", unassigned.length);
      console.log("Lot DL-LOT-290626-200281 có nằm trong kết quả không?", isFound ? "CÓ" : "KHÔNG");
    }

  } finally {
    // 6. Xóa user test để dọn dẹp DB
    console.log("Đang dọn dẹp user test...");
    await adminSupabase.auth.admin.deleteUser(userId);
    console.log("Đã xóa user test.");
  }
}

main();
