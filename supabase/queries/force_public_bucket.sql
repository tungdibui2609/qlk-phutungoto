-- =============================================================================
-- FORCE PUBLIC BUCKET AND POLICIES
-- =============================================================================

-- 1. Force bucket to be public (Update existing)
UPDATE storage.buckets SET public = true WHERE id = 'company-assets';

-- 2. Insert if not exists (Safe insert)
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
SELECT 'company-assets', 'company-assets', true, false, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'company-assets');

-- 3. Reset Policies completely
DO $$ 
BEGIN 
    BEGIN EXECUTE 'DROP POLICY "Public Read Company Assets" ON storage.objects'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "Auth Upload Company Assets" ON storage.objects'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "Auth Manage Company Assets" ON storage.objects'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "Auth Delete Company Assets" ON storage.objects'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- 4. Re-create Policies (No ownership requirement)
CREATE POLICY "Public Read Company Assets" ON storage.objects FOR SELECT USING (bucket_id = 'company-assets');
CREATE POLICY "Auth Upload Company Assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-assets');
CREATE POLICY "Auth Manage Company Assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'company-assets');
CREATE POLICY "Auth Delete Company Assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'company-assets');

-- 5. Grant Permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON public.company_settings TO authenticated;
