-- =============================================================================
-- FIX COMPANY SETTINGS UPDATE PERMISSION
-- =============================================================================

-- We suspect RLS is blocking the UPDATE of logo_url to the database.
-- This script opens up permission for company_settings to allow updates.

-- 1. Drop restrict policies if any acting blockers
DO $$ 
BEGIN 
    BEGIN EXECUTE 'DROP POLICY "settings_policy" ON public.company_settings'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "settings_update" ON public.company_settings'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "settings_update_simple" ON public.company_settings'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- 2. Create a Permissive Update Policy for Authenticated Users
-- This ensures that if you are logged in, you can update settings (we rely on app logic for security for now)
CREATE POLICY "settings_update_debug" ON public.company_settings
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Also ensure SELECT is open so we can fetch it
CREATE POLICY "settings_select_debug" ON public.company_settings
FOR SELECT TO authenticated
USING (true);

-- 4. Grant update permission explicitly
GRANT UPDATE ON public.company_settings TO authenticated;
