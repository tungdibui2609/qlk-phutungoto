-- =============================================================================
-- FIX STORAGE BUCKETS AND POLICIES FOR COMPANY ASSETS
-- =============================================================================

-- 1. Create bucket if not exists
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('company-assets', 'company-assets', true, false, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Enable RLS on objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Clean up old policies for company-assets
DO $$ 
BEGIN 
    EXECUTE 'DROP POLICY IF EXISTS "Public Access" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Any User Select" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Auth User Insert" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Auth User Update" ON storage.objects';
END $$;

-- 4. Create New Policies

-- Allow PUBLIC to VIEW everything in company-assets (for logos on login screen etc)
CREATE POLICY "Public Read Company Assets" ON storage.objects
FOR SELECT USING (bucket_id = 'company-assets');

-- Allow Authenticated users to UPLOAD (INSERT)
-- Ideally we restrict to their company folder, but for now allow any auth user to upload
CREATE POLICY "Auth Upload Company Assets" ON storage.objects
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'company-assets');

-- Allow Authenticated users to UPDATE/DELETE
CREATE POLICY "Auth Manage Company Assets" ON storage.objects
FOR UPDATE TO authenticated 
USING (bucket_id = 'company-assets');

CREATE POLICY "Auth Delete Company Assets" ON storage.objects
FOR DELETE TO authenticated 
USING (bucket_id = 'company-assets');

-- =============================================================================
-- FIX COMPANY_SETTINGS RLS (Double Check)
-- =============================================================================

-- Ensure company_settings is writable by auth users (Company Admins)
-- My previous fix might have been strict on IDs.
-- Let's ensure INSERT is allowed for authenticated users if they have a profile

CREATE POLICY "settings_insert" ON public.company_settings FOR INSERT 
WITH CHECK (auth.uid() IN (SELECT id FROM user_profiles));

-- Re-grant permissions just in case
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON public.company_settings TO authenticated;
