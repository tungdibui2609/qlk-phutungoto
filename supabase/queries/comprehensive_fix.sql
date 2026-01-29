-- =============================================================================
-- COMPREHENSIVE FIX FOR SUPABASE AUTH & DATABASE
-- =============================================================================
-- Chạy script này trong Supabase SQL Editor với role "postgres"
-- =============================================================================

-- 1. GRANT PERMISSIONS FOR AUTH SCHEMA
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO postgres, service_role;

-- 2. GRANT PERMISSIONS FOR PUBLIC SCHEMA
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, authenticated, service_role;

-- 3. FIX SUPABASE INTERNAL ROLES
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
        GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
        GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        GRANT USAGE ON SCHEMA auth TO authenticator;
        GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticator;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_user') THEN
        GRANT ALL ON ALL TABLES IN SCHEMA auth TO dashboard_user;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO dashboard_user;
    END IF;
END $$;

-- 4. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

-- 5. CREATE SYSTEM COMPANY
INSERT INTO public.companies (id, name, code, is_active, created_at, updated_at)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'AnyWarehouse (Hệ thống)',
    'anywarehouse',
    true,
    now(),
    now()
)
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active;

-- 6. CREATE COMPANY SETTINGS FOR SYSTEM COMPANY
INSERT INTO public.company_settings (id, name, short_name)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'AnyWarehouse (Hệ thống)',
    'System'
)
ON CONFLICT (id) DO NOTHING;

-- 7. DELETE & RECREATE SUPER ADMIN
DELETE FROM public.user_profiles WHERE email = 'tungdibui2609@gmail.com';
DELETE FROM auth.users WHERE email = 'tungdibui2609@gmail.com';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'tungdibui2609@gmail.com',
    crypt('123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username": "super_admin", "full_name": "Super Admin"}',
    now(), now()
);

INSERT INTO public.user_profiles (
    id, email, full_name, username, is_active, company_id, allowed_systems
) VALUES (
    'a0000000-0000-0000-0000-000000000000',
    'tungdibui2609@gmail.com',
    'Super Admin', 'super_admin', true,
    'a0000000-0000-0000-0000-000000000001',
    ARRAY['ALL']
);

-- 8. VERIFICATION
SELECT 'Done! Check results below:' as status;

SELECT 'auth.users' as table_name, count(*) as count FROM auth.users;
SELECT 'companies' as table_name, count(*) as count FROM public.companies;
SELECT 'user_profiles' as table_name, count(*) as count FROM public.user_profiles;
