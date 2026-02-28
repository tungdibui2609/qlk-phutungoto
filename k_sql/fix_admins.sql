-- Cập nhật account_level thành 2 (Quản trị viên) và cấp quyền truy cập ALL 
-- cho những user_profiles là admin (có quyền system.full_access) nhưng chưa được cấp level.

UPDATE public.user_profiles
SET 
    account_level = 2,
    allowed_systems = '["ALL"]'::jsonb
WHERE 
    permissions @> '["system.full_access"]'::jsonb 
    AND (account_level IS NULL OR account_level != 1 AND account_level != 2);
