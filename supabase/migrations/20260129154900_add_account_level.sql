-- =============================================================================
-- ADD ACCOUNT_LEVEL COLUMN AND FIX RLS
-- =============================================================================
-- Account Levels:
--   1 = Super Admin (only tungdibui2609@gmail.com)
--   2 = Company Admin (created via Super Admin Console)
--   3 = Employee (created by Company Admin)
-- =============================================================================

-- 1. Add account_level column
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS account_level INTEGER DEFAULT 3;

COMMENT ON COLUMN public.user_profiles.account_level IS 
'Account level: 1=Super Admin, 2=Company Admin, 3=Employee';

-- 2. Update existing users with correct levels
UPDATE public.user_profiles 
SET account_level = 1 
WHERE email = 'tungdibui2609@gmail.com';

-- Set Level 2 for users with system.full_access permission
UPDATE public.user_profiles 
SET account_level = 2 
WHERE 'system.full_access' = ANY(permissions)
  AND email != 'tungdibui2609@gmail.com';

-- 3. Drop ALL existing RLS policies on user_profiles
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'user_profiles'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.user_profiles';
    END LOOP;
END $$;

-- 4. Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Create SIMPLE RLS policies (NO recursive functions!)

-- Super Admin can do everything
CREATE POLICY "super_admin_all" ON public.user_profiles
    FOR ALL 
    USING (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');

-- Users can read their own profile
CREATE POLICY "users_read_own" ON public.user_profiles
    FOR SELECT 
    USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "users_update_own" ON public.user_profiles
    FOR UPDATE 
    USING (id = auth.uid());

-- Company admins (level 2) can read all profiles in their company
-- This uses a subquery instead of a function to avoid recursion
CREATE POLICY "company_admin_read_company" ON public.user_profiles
    FOR SELECT
    USING (
        company_id IN (
            SELECT up.company_id 
            FROM public.user_profiles up 
            WHERE up.id = auth.uid() 
              AND up.account_level <= 2
        )
    );

-- Company admins can insert employees in their company
CREATE POLICY "company_admin_insert" ON public.user_profiles
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT up.company_id 
            FROM public.user_profiles up 
            WHERE up.id = auth.uid() 
              AND up.account_level <= 2
        )
    );

-- Company admins can update employees in their company
CREATE POLICY "company_admin_update_company" ON public.user_profiles
    FOR UPDATE
    USING (
        company_id IN (
            SELECT up.company_id 
            FROM public.user_profiles up 
            WHERE up.id = auth.uid() 
              AND up.account_level <= 2
        )
        AND id != auth.uid() -- Can't demote themselves
    );

-- 6. Grant permissions
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

-- 7. Verify
SELECT 
    id, 
    email, 
    account_level,
    permissions
FROM public.user_profiles 
ORDER BY account_level, email;
