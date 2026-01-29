-- =============================================================================
-- RESTORE SUPER ADMIN ACCOUNT - FINAL WORKING VERSION
-- =============================================================================
-- Email: tungdibui2609@gmail.com
-- Password: 123456
-- 
-- IMPORTANT: Token columns MUST be empty string (''), NOT NULL!
-- GoTrue cannot scan NULL into Go strings.
-- =============================================================================

-- 1. Clean up any existing data
DELETE FROM public.user_profiles WHERE email = 'tungdibui2609@gmail.com';
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'tungdibui2609@gmail.com');
DELETE FROM auth.users WHERE email = 'tungdibui2609@gmail.com';

-- 2. Create system company
INSERT INTO public.companies (id, name, code, is_active)
VALUES ('a0000000-0000-0000-0000-000000000001', 'AnyWarehouse', 'anywarehouse', true)
ON CONFLICT (code) DO NOTHING;

-- 3. Create Auth User (with empty strings for tokens, NOT NULL!)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
    is_sso_user, is_anonymous,
    -- CRITICAL: These must be empty strings, not NULL
    confirmation_token, recovery_token, email_change_token_new, 
    email_change, email_change_token_current, phone_change, 
    phone_change_token, reauthentication_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '1d502b01-df8b-4f27-9965-fa550a5b4096',
    'authenticated', 'authenticated',
    'tungdibui2609@gmail.com',
    crypt('123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"email_verified": true}',
    now(), now(), 
    false, false,
    -- Empty strings for tokens
    '', '', '', '', '', '', '', ''
);

-- 4. Create Identity
INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider, 
    last_sign_in_at, created_at, updated_at, id
) VALUES (
    '1d502b01-df8b-4f27-9965-fa550a5b4096',
    '1d502b01-df8b-4f27-9965-fa550a5b4096',
    '{"sub": "1d502b01-df8b-4f27-9965-fa550a5b4096", "email": "tungdibui2609@gmail.com", "email_verified": true, "phone_verified": false}',
    'email',
    now(), now(), now(),
    'e57966b4-04c0-4396-ae69-64083d811b68'
);

-- 5. Create User Profile
INSERT INTO public.user_profiles (
    id, email, full_name, username, is_active, company_id, allowed_systems
) VALUES (
    '1d502b01-df8b-4f27-9965-fa550a5b4096',
    'tungdibui2609@gmail.com',
    'Super Admin', 'super_admin', true,
    'a0000000-0000-0000-0000-000000000001',
    ARRAY['ALL']
);

SELECT 'Super Admin restored successfully!' as status,
       'Email: tungdibui2609@gmail.com' as email,
       'Password: 123456' as password;
