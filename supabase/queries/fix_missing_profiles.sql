-- =============================================================================
-- FIX MISSING USER PROFILES FOR COMPANY ADMINS
-- =============================================================================
-- This script finds auth users that don't have corresponding user_profiles
-- and creates them with admin permissions.
-- =============================================================================

-- 1. Find orphan users (auth.users without user_profiles)
SELECT 
    au.id,
    au.email,
    au.created_at,
    'MISSING PROFILE' as status
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL
    AND au.email != 'tungdibui2609@gmail.com';  -- Exclude Super Admin

-- 2. Create missing profiles for company admins
-- For each orphan user, find their company via email domain or manual assignment
-- Then insert the profile

-- EXAMPLE: If traicayabc@gmail.com exists in auth.users but not in user_profiles:
DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_company_id UUID;
BEGIN
    -- Find orphan users and their companies
    FOR v_user_id, v_email IN
        SELECT au.id, au.email
        FROM auth.users au
        LEFT JOIN public.user_profiles up ON au.id = up.id
        WHERE up.id IS NULL
            AND au.email != 'tungdibui2609@gmail.com'
    LOOP
        -- Try to find company by matching email or code pattern
        SELECT c.id INTO v_company_id
        FROM public.companies c
        WHERE c.email = v_email
           OR LOWER(v_email) LIKE '%' || LOWER(c.code) || '%'
        LIMIT 1;
        
        IF v_company_id IS NOT NULL THEN
            -- Create the profile
            INSERT INTO public.user_profiles (
                id, email, full_name, company_id, 
                is_active, department, permissions, allowed_systems
            ) VALUES (
                v_user_id,
                v_email,
                'Company Admin',
                v_company_id,
                true,
                'Hệ thống',
                ARRAY['system.full_access'],
                ARRAY['ALL']
            )
            ON CONFLICT (id) DO UPDATE SET
                company_id = EXCLUDED.company_id,
                department = 'Hệ thống',
                permissions = ARRAY['system.full_access'],
                allowed_systems = ARRAY['ALL'];
            
            RAISE NOTICE 'Created profile for % linked to company %', v_email, v_company_id;
        ELSE
            RAISE WARNING 'No company found for user %', v_email;
        END IF;
    END LOOP;
END $$;

-- 3. Verify the fix
SELECT 
    up.id,
    up.email,
    up.department,
    up.permissions,
    up.company_id,
    c.name as company_name
FROM public.user_profiles up
LEFT JOIN public.companies c ON up.company_id = c.id
ORDER BY up.created_at DESC;
