-- =============================================================================
-- FIX SYSTEMS (WAREHOUSES) RLS POLICIES
-- =============================================================================

-- 1. Enable RLS (just to be safe)
ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policies to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for all users" ON public.systems;
DROP POLICY IF EXISTS "Enable insert for admins" ON public.systems;
DROP POLICY IF EXISTS "Enable update for admins" ON public.systems;
DROP POLICY IF EXISTS "Enable delete for admins" ON public.systems;

-- 3. Create comprehensive policies

-- READ: All authenticated users can read systems (needed for dropdowns)
CREATE POLICY "Enable read access for all users"
ON public.systems FOR SELECT
TO authenticated
USING (true);

-- INSERT: Only Admins (Level 1 & 2)
CREATE POLICY "Enable insert for admins"
ON public.systems FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) IN (1, 2)
);

-- UPDATE: Only Admins (Level 1 & 2)
CREATE POLICY "Enable update for admins"
ON public.systems FOR UPDATE
TO authenticated
USING (
    (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) IN (1, 2)
)
WITH CHECK (
    (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) IN (1, 2)
);

-- DELETE: Only Admins (Level 1 & 2)
CREATE POLICY "Enable delete for admins"
ON public.systems FOR DELETE
TO authenticated
USING (
    (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) IN (1, 2)
);

-- 4. Grant Table Permissions
GRANT ALL ON public.systems TO authenticated;
GRANT ALL ON public.systems TO service_role;
