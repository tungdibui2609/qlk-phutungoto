-- EMERGENCY RECURSION & LOCKOUT FIX
-- This script fixes the infinite loop in RLS and restores profile access.

BEGIN;

-- 1. Ensure the helper function is perfectly safe (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
    -- Directly query the table. Since this is SECURITY DEFINER, it doesn't trigger RLS.
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. RESET User Profiles Policies (BREAK THE RECURSION)
DROP POLICY IF EXISTS "Permissive Self Read" ON public.user_profiles;
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.user_profiles;

-- Allow users to see their own data (Base Permissive)
CREATE POLICY "Permissive Self Read" ON public.user_profiles 
FOR SELECT USING (id = auth.uid());

-- Restrictive boundary using the safe function (Avoids subquery recursion)
CREATE POLICY "Strict Tenant Boundary" ON public.user_profiles 
AS RESTRICTIVE FOR ALL USING (
    (company_id = get_user_company_id())
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
);

-- 3. FIX Systems and System Configs Policies
-- These must also have a permissive part if we use restrictive.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.systems;
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.systems;

CREATE POLICY "Enable read access for all users" ON public.systems 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Strict Tenant Boundary" ON public.systems
AS RESTRICTIVE FOR ALL USING (
    (company_id = get_user_company_id())
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
);

-- System Configs
DROP POLICY IF EXISTS "Enable read access for all users" ON public.system_configs;
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.system_configs;

CREATE POLICY "Enable read access for all users" ON public.system_configs 
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Strict Tenant Boundary" ON public.system_configs
AS RESTRICTIVE FOR ALL USING (
    (company_id = get_user_company_id())
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
);

-- 4. FIX Company Settings and Roles (UI Metadata)
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.company_settings;
CREATE POLICY "Strict Tenant Boundary" ON public.company_settings
AS RESTRICTIVE FOR ALL USING (
    (id = get_user_company_id())
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
);

-- Roles: Must be readable for the company + templates
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.roles;
CREATE POLICY "Strict Tenant Boundary" ON public.roles
AS RESTRICTIVE FOR ALL USING (
    (company_id = get_user_company_id())
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
    OR
    (company_id = (SELECT id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1))
);

-- 5. CLEANUP: Ensure no profiles are abandoned without a company
UPDATE public.user_profiles 
SET company_id = (SELECT id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1)
WHERE company_id IS NULL;

-- 6. ENSURE COMPANY SETTINGS EXIST
INSERT INTO public.company_settings (id, name, short_name)
SELECT id, name, code
FROM public.companies
ON CONFLICT (id) DO NOTHING;

COMMIT;
