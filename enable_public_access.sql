-- Copy đoạn mã này và chạy trong phần "SQL Editor" của Supabase hoặc Dashboard

-- 1. Bật tính năng bảo mật hàng (nếu chưa bật)
alter table "public"."company_settings" enable row level security;

-- 2. Xóa policy cũ nếu trùng tên (để tránh lỗi)
drop policy if exists "Enable public read access" on "public"."company_settings";

-- 3. Tạo policy mới: Cho phép TẤT CẢ mọi người (bao gồm chưa đăng nhập) xem thông tin
create policy "Enable public read access"
on "public"."company_settings"
for select
using (true);
