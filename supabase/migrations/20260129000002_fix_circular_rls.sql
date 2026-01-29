-- Fix Circular RLS in User Profiles
-- The function get_user_company_id() queries user_profiles.
-- The Strict Policy calls get_user_company_id().
-- This creates a loop (or blocks access) if the function cannot read the user's own profile.
-- We add "id = auth.uid()" to the Strict Policy to explicitly allow a user to read/verify their own profile.

DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.user_profiles;

CREATE POLICY "Strict Tenant Boundary" ON public.user_profiles
AS RESTRICTIVE FOR ALL USING (
    (company_id = get_user_company_id())
    OR
    (id = auth.uid()) -- BREAK THE LOOP: Allow reading own profile to fetch company_id
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
    OR
    (company_id IS NULL)
);
