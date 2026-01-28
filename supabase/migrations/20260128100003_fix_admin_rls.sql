-- Allow Super Admin to manage user_profiles for ANY company
DO $$
BEGIN
    -- Drop existing restrictive policies if necessary (or just add a more permissive one)
    -- We want to ensure the Super Admin can INSERT/UPDATE/DELETE rows where company_id is NOT their own.

    -- 1. Ensure Superuser Bypass is clearly defined for user_profiles
    DROP POLICY IF EXISTS "Superuser Bypass Policy" ON public.user_profiles;
    
    CREATE POLICY "Superuser Bypass Policy" ON public.user_profiles
    FOR ALL
    USING (
        auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    )
    WITH CHECK (
        auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    );

END $$;
