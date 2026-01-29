-- ULTIMA MULTI-TENANT ISOLATION REPAIR
-- This script fixes recursion issues, role assignments, and metadata visibility.

BEGIN;

-- 1. FIX get_user_company_id() to be more direct and avoid recursion if possible
-- We use a direct subquery with LIMIT 1 to be safe.
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. RESET POLICIES for key metadata tables to be PERMISSIVE for SELECT
-- Company settings should be readable by anyone logged in (they only contain name/logo/metadata)
-- Strict isolation can be on PRIVATE settings, but name/logo are needed for the UI.
DROP POLICY IF EXISTS "Public read company settings" ON public.company_settings;
CREATE POLICY "Public read company settings" ON public.company_settings 
FOR SELECT USING (auth.role() = 'authenticated');

-- Companies table should also be readable so users can see company names/codes
DROP POLICY IF EXISTS "Public read companies" ON public.companies;
CREATE POLICY "Public read companies" ON public.companies 
FOR SELECT USING (auth.role() = 'authenticated');

-- 3. FIX RECURSIVE POLICIES on user_profiles
-- Users must be able to see their own profile and people in their own company.
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.user_profiles;
CREATE POLICY "Permissive Self Read" ON public.user_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Strict Tenant Boundary" ON public.user_profiles AS RESTRICTIVE FOR ALL USING (
    (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
);

-- 4. ASSIGN DEFAULT ADMIN ROLE to company creators if missing
-- If a user is in "Hệ thống" department but has no role, give them the 'admin' role of their company.
DO $$
DECLARE
    user_rec RECORD;
    admin_role_id UUID;
BEGIN
    FOR user_rec IN (
        SELECT id, company_id 
        FROM public.user_profiles 
        WHERE department = 'Hệ thống' AND role_id IS NULL AND company_id IS NOT NULL
    ) LOOP
        -- Find the 'admin' role for that specific company
        SELECT id INTO admin_role_id FROM public.roles 
        WHERE code = 'admin' AND company_id = user_rec.company_id 
        LIMIT 1;
        
        IF admin_role_id IS NOT NULL THEN
            UPDATE public.user_profiles SET role_id = admin_role_id WHERE id = user_rec.id;
        END IF;
    END LOOP;
END $$;

-- 5. RE-SYNC ROLES for any orphans
-- If user has a role_id but it belongs to another company, find the local equivalent.
DO $$
DECLARE
    user_rec RECORD;
    local_role_id UUID;
BEGIN
    FOR user_rec IN (
        SELECT up.id, up.company_id, r.code 
        FROM public.user_profiles up
        JOIN public.roles r ON up.role_id = r.id
        WHERE r.company_id != up.company_id
    ) LOOP
        -- Find the same role code within the user's company
        SELECT id INTO local_role_id FROM public.roles 
        WHERE code = user_rec.code AND company_id = user_rec.company_id 
        LIMIT 1;
        
        IF local_role_id IS NOT NULL THEN
            UPDATE public.user_profiles SET role_id = local_role_id WHERE id = user_rec.id;
        END IF;
    END LOOP;
END $$;

-- 6. ENSURE COMPANY SETTINGS EXIST
INSERT INTO public.company_settings (id, name, short_name)
SELECT id, name, code
FROM public.companies
ON CONFLICT (id) DO NOTHING;

COMMIT;
