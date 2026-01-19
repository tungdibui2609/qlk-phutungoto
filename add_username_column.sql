-- Chạy trong SQL Editor của Supabase

-- 1. Thêm cột username vào bảng user_profiles
ALTER TABLE "public"."user_profiles" 
ADD COLUMN "username" text UNIQUE;

-- 2. (Tùy chọn) Thêm index để tìm kiếm nhanh hơn
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON "public"."user_profiles" ("username");

-- 3. Cập nhật policy (nếu cần) - thường policy cũ đã bao phủ "update own profile"
