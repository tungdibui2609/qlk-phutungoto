-- =============================================================================
-- COMPREHENSIVE RLS FIX FOR ALL TABLES
-- =============================================================================
-- This script fixes RLS policies on ALL key tables to prevent recursion
-- =============================================================================

-- ========== USER_PROFILES ==========
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
DO $$ DECLARE pol RECORD;
BEGIN FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles'
    LOOP EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.user_profiles'; END LOOP;
END $$;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.user_profiles FOR SELECT 
    USING (id = auth.uid() OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');
CREATE POLICY "profiles_update" ON public.user_profiles FOR UPDATE 
    USING (id = auth.uid() OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');
CREATE POLICY "profiles_insert" ON public.user_profiles FOR INSERT 
    WITH CHECK (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');

-- ========== SYSTEMS ==========
ALTER TABLE public.systems DISABLE ROW LEVEL SECURITY;
DO $$ DECLARE pol RECORD;
BEGIN FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'systems'
    LOOP EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.systems'; END LOOP;
END $$;
ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: Use security definer function to avoid recursion
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "systems_select" ON public.systems FOR SELECT 
    USING (company_id = get_my_company_id() OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');
CREATE POLICY "systems_manage" ON public.systems FOR ALL 
    USING (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');

-- ========== SYSTEM_CONFIGS ==========
ALTER TABLE public.system_configs DISABLE ROW LEVEL SECURITY;
DO $$ DECLARE pol RECORD;
BEGIN FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'system_configs'
    LOOP EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.system_configs'; END LOOP;
END $$;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configs_select" ON public.system_configs FOR SELECT 
    USING (company_id = get_my_company_id() OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');
CREATE POLICY "configs_manage" ON public.system_configs FOR ALL 
    USING (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');

-- ========== COMPANY_SETTINGS ==========
ALTER TABLE public.company_settings DISABLE ROW LEVEL SECURITY;
DO $$ DECLARE pol RECORD;
BEGIN FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'company_settings'
    LOOP EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.company_settings'; END LOOP;
END $$;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select" ON public.company_settings FOR SELECT 
    USING (id = get_my_company_id() OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');
CREATE POLICY "settings_manage" ON public.company_settings FOR ALL 
    USING (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');

-- ========== GRANT PERMISSIONS ==========
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.systems TO authenticated;
GRANT ALL ON public.system_configs TO authenticated;
GRANT ALL ON public.company_settings TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_company_id() TO authenticated;

-- ========== VERIFY ==========
SELECT 'user_profiles' as tbl, count(*) as policies FROM pg_policies WHERE tablename = 'user_profiles'
UNION ALL
SELECT 'systems', count(*) FROM pg_policies WHERE tablename = 'systems'
UNION ALL
SELECT 'system_configs', count(*) FROM pg_policies WHERE tablename = 'system_configs'
UNION ALL
SELECT 'company_settings', count(*) FROM pg_policies WHERE tablename = 'company_settings';
