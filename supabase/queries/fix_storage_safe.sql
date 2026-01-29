-- =============================================================================
-- FIX STORAGE BUCKETS AND POLICIES (PERMISSION SAFE VERSION)
-- =============================================================================

-- 1. Create bucket if not exists
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('company-assets', 'company-assets', true, false, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop policies safely (Ignore if not exists or permission denied on specific system policies)
DO $$ 
BEGIN 
    -- Try to clean up previous attempts
    BEGIN EXECUTE 'DROP POLICY "Public Read Company Assets" ON storage.objects'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "Auth Upload Company Assets" ON storage.objects'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "Auth Manage Company Assets" ON storage.objects'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "Auth Delete Company Assets" ON storage.objects'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- 3. Create New Policies for storage.objects
-- Note: We do NOT use ALTER TABLE here as it requires ownership. We assume RLS is enabled.
CREATE POLICY "Public Read Company Assets" ON storage.objects FOR SELECT USING (bucket_id = 'company-assets');

CREATE POLICY "Auth Upload Company Assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "Auth Manage Company Assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'company-assets');

CREATE POLICY "Auth Delete Company Assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'company-assets');

-- =============================================================================
-- FIX COMPANY_SETTINGS PERMISSIONS
-- =============================================================================

-- Ensure company_settings is writable
GRANT ALL ON public.company_settings TO authenticated;

-- Ensure users can insert into company_settings (for new companies)
DO $$ 
BEGIN 
    BEGIN EXECUTE 'DROP POLICY "settings_insert" ON public.company_settings'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "settings_insert" ON public.company_settings FOR INSERT 
WITH CHECK (auth.uid() IN (SELECT id FROM user_profiles));
