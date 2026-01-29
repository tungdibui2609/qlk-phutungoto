-- Thay 'EMAIL_HOAC_USERNAME_CUA_BAN' bằng email hoặc username (ví dụ: any.thukho@system.local)
-- Lưu ý: Xoá trong auth.users sẽ tự động xoá trong user_profiles nếu có thiết lập liên kết khoá ngoại (Cascade).

DELETE FROM auth.users 
WHERE email = 'any.thukho@system.local'; 

-- Hoặc xoá theo user metadata nếu cần
-- DELETE FROM auth.users WHERE raw_user_meta_data->>'username' = 'any.thukho';
