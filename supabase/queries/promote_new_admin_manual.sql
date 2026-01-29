-- PROMOTE MANUALLY CREATED USER TO SUPER ADMIN
-- Run this AFTER you have manually created the user 'tungdibui2609@gmail.com' in the Supabase Dashboard.

BEGIN;

-- 1. Get the ID of the newly created user (from auth.users)
--    and plug it into user_profiles
INSERT INTO public.user_profiles (id, email, full_name, username, is_active, company_id)
SELECT 
    id,
    email,
    'Super Admin',
    'admin',
    true,
    (SELECT id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1)
FROM auth.users 
WHERE email = 'tungdibui2609@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET 
    company_id = EXCLUDED.company_id,
    username = 'admin',
    full_name = 'Super Admin',
    is_active = true;

-- 2. Grant permissions (just in case)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

COMMIT;
