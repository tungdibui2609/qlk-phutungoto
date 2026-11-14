-- =============================================================================
-- TẠO BẢNG & STORAGE BUCKET CHO HÌNH ẢNH CHỨNG MINH NHẬP/XUẤT SỐ LIỆU
-- Cô lập theo system_code & company_id, sẵn sàng cho đồng bộ Google Drive
-- =============================================================================

-- 1. Storage bucket: operation-images
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
    'operation-images',
    'operation-images',
    true,
    false,
    10485760,
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 10485760;

-- Storage policies
DO $$
BEGIN
    BEGIN EXECUTE 'DROP POLICY "Public Read Operation Images" ON storage.objects'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "Auth Upload Operation Images" ON storage.objects'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "Auth Update Operation Images" ON storage.objects'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "Auth Delete Operation Images" ON storage.objects'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "Public Read Operation Images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'operation-images');

CREATE POLICY "Auth Upload Operation Images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'operation-images');

CREATE POLICY "Auth Update Operation Images"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'operation-images');

CREATE POLICY "Auth Delete Operation Images"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'operation-images');

-- 2. Bảng operation_images
CREATE TABLE IF NOT EXISTS public.operation_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NULL,
    system_code text NOT NULL,
    shift_id uuid NOT NULL REFERENCES public.delivery_shifts(id) ON DELETE CASCADE,
    sub_shift_id uuid NULL REFERENCES public.delivery_sub_shifts(id) ON DELETE SET NULL,
    journal_id uuid NULL REFERENCES public.delivery_journal(id) ON DELETE SET NULL,
    scope text NOT NULL DEFAULT 'journal' CHECK (scope IN ('journal', 'sub_shift', 'shift')),
    direction text NULL CHECK (direction IN ('in', 'out')),
    job_name text NULL,
    item_name text NULL,
    quantity numeric NULL,
    unit text NULL,
    storage_bucket text NOT NULL DEFAULT 'operation-images',
    storage_path text NOT NULL,
    public_url text NOT NULL,
    file_size integer NULL,
    mime_type text NULL,
    captured_by uuid NULL,
    captured_by_name text NULL,
    captured_at timestamptz NOT NULL DEFAULT now(),
    notes text NULL,
    drive_file_id text NULL,
    drive_web_url text NULL,
    drive_synced_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operation_images_system_captured
    ON public.operation_images (system_code, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_operation_images_shift
    ON public.operation_images (shift_id);

CREATE INDEX IF NOT EXISTS idx_operation_images_journal
    ON public.operation_images (journal_id);

CREATE INDEX IF NOT EXISTS idx_operation_images_sub_shift
    ON public.operation_images (sub_shift_id);

ALTER TABLE public.operation_images ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    BEGIN EXECUTE 'DROP POLICY "operation_images_select_auth" ON public.operation_images'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "operation_images_insert_auth" ON public.operation_images'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "operation_images_update_auth" ON public.operation_images'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "operation_images_delete_auth" ON public.operation_images'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "operation_images_select_auth"
    ON public.operation_images FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "operation_images_insert_auth"
    ON public.operation_images FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "operation_images_update_auth"
    ON public.operation_images FOR UPDATE TO authenticated
    USING (true);

CREATE POLICY "operation_images_delete_auth"
    ON public.operation_images FOR DELETE TO authenticated
    USING (true);

GRANT ALL ON public.operation_images TO authenticated;
GRANT SELECT ON public.operation_images TO anon;
