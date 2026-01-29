-- RESTORE SUPER ADMIN ACCOUNT
-- Password will be reset to: 123456

BEGIN;

-- 1. Enable crypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Delete existing entries to avoid conflicts (clean slate)
DELETE FROM public.user_profiles WHERE email = 'tungdibui2609@gmail.com';
DELETE FROM auth.users WHERE email = 'tungdibui2609@gmail.com';

-- 3. Create Auth User
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'tungdibui2609@gmail.com',
    crypt('123456', gen_salt('bf')), -- Mật khẩu mặc định: 123456
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username": "admin"}',
    now(),
    now()
);

-- 4. Create User Profile
INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    username,
    is_active,
    company_id
)
SELECT 
    id,
    email,
    'Super Admin',
    'admin',
    true,
    (SELECT id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1)
FROM auth.users 
WHERE email = 'tungdibui2609@gmail.com';

COMMIT;
