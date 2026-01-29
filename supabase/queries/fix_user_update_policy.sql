-- =============================================================================
-- FIX USER PROFILES UPDATE POLICY
-- =============================================================================

-- Drop existing update policy if it restricts to self only
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow update for admins" ON public.user_profiles;

-- Create comprehensive UPDATE policy
CREATE POLICY "Allow update users"
ON public.user_profiles
FOR UPDATE
USING (
    -- 1. Super Admin (Level 1) can update anyone
    (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) = 1
    OR
    -- 2. Company Admin (Level 2) can update users in THEIR company
    (
        (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) = 2
        AND 
        company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    )
    OR
    -- 3. Users can update themselves (restricted fields logic handled in UI, RLS allows row access)
    auth.uid() = id
);

-- Ensure SELECT policy is also permissive enough (usually it is, but let's reinforce)
-- (Assuming SELECT policies are already fixed by previous tasks, skipping to avoid conflicts)

-- Grant permissions just in case
GRANT UPDATE ON public.user_profiles TO authenticated;
