const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://viqeyhpnevxcowsffueb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcWV5aHBuZXZ4Y293c2ZmdWViIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODMxMjA3MiwiZXhwIjoyMDgzODg4MDcyfQ.Go_y0Zubw2-XUcGiwIOvbfEjVfeIvhLsnIBHKjqdp7U';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
    try {
        console.log("1. Lấy danh sách 5 lệnh sản xuất gần nhất...");
        const { data: productions, error: fetchErr } = await supabase
            .from('productions')
            .select('id, code, name, status')
            .order('updated_at', { ascending: false })
            .limit(5);

        if (fetchErr) {
            console.error("Lỗi lấy dữ liệu:", fetchErr);
            return;
        }

        console.log("Danh sách lệnh sản xuất:", productions);

        const inProgress = productions.find(p => p.status === 'IN_PROGRESS');
        if (!inProgress) {
            console.log("Không tìm thấy lệnh sản xuất nào ở trạng thái IN_PROGRESS để test.");
            return;
        }

        console.log(`\n2. Thử cập nhật lệnh sản xuất ${inProgress.code} (ID: ${inProgress.id}) sang DONE...`);
        const { data: updateData, error: updateErr } = await supabase
            .from('productions')
            .update({ status: 'DONE', updated_at: new Date().toISOString() })
            .eq('id', inProgress.id)
            .select();

        if (updateErr) {
            console.error("CẬP NHẬT THẤT BẠI. Chi tiết lỗi:", updateErr);
        } else {
            console.log("Cập nhật thành công!", updateData);
            
            // Revert lại trạng thái cũ để không ảnh hưởng dữ liệu người dùng
            console.log("\n3. Đang revert lại trạng thái IN_PROGRESS...");
            await supabase
                .from('productions')
                .update({ status: 'IN_PROGRESS', updated_at: new Date().toISOString() })
                .eq('id', inProgress.id);
            console.log("Revert thành công.");
        }

    } catch (e) {
        console.error("Lỗi ngoại lệ:", e);
    }
}

main();
