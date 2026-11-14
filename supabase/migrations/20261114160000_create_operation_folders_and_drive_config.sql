-- =============================================================================
-- CÂY THƯ MỤC ALBUM ẢNH & CẤU HÌNH ĐỒNG BỘ GOOGLE DRIVE (WMS)
-- Cô lập dữ liệu theo system_code & company_id
-- =============================================================================

-- 1. Bảng cây thư mục album (hỗ trợ lồng nhau nhiều cấp qua parent_id)
CREATE TABLE IF NOT EXISTS public.operation_folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NULL,
    system_code text NOT NULL,
    parent_id uuid NULL REFERENCES public.operation_folders(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_by uuid NULL,
    created_by_name text NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operation_folders_system
    ON public.operation_folders (system_code, parent_id, name);

ALTER TABLE public.operation_folders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    BEGIN EXECUTE 'DROP POLICY "operation_folders_select_auth" ON public.operation_folders'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "operation_folders_insert_auth" ON public.operation_folders'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "operation_folders_update_auth" ON public.operation_folders'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "operation_folders_delete_auth" ON public.operation_folders'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "operation_folders_select_auth" ON public.operation_folders FOR SELECT TO authenticated USING (true);
CREATE POLICY "operation_folders_insert_auth" ON public.operation_folders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "operation_folders_update_auth" ON public.operation_folders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "operation_folders_delete_auth" ON public.operation_folders FOR DELETE TO authenticated USING (true);

GRANT ALL ON public.operation_folders TO authenticated;

-- 2. Gắn folder_id vào operation_images
ALTER TABLE public.operation_images
    ADD COLUMN IF NOT EXISTS folder_id uuid NULL REFERENCES public.operation_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operation_images_folder
    ON public.operation_images (folder_id);

-- 3. Bảng cấu hình Google Drive (Apps Script Webhook) theo phân hệ kho
CREATE TABLE IF NOT EXISTS public.operation_drive_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NULL,
    system_code text NOT NULL UNIQUE,
    webhook_url text NULL,
    root_folder_name text NOT NULL DEFAULT 'WMS_HinhAnh_Kho',
    auto_sync_enabled boolean NOT NULL DEFAULT false,
    updated_by uuid NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operation_drive_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    BEGIN EXECUTE 'DROP POLICY "operation_drive_settings_select_auth" ON public.operation_drive_settings'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "operation_drive_settings_insert_auth" ON public.operation_drive_settings'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "operation_drive_settings_update_auth" ON public.operation_drive_settings'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "operation_drive_settings_delete_auth" ON public.operation_drive_settings'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "operation_drive_settings_select_auth" ON public.operation_drive_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "operation_drive_settings_insert_auth" ON public.operation_drive_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "operation_drive_settings_update_auth" ON public.operation_drive_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "operation_drive_settings_delete_auth" ON public.operation_drive_settings FOR DELETE TO authenticated USING (true);

GRANT ALL ON public.operation_drive_settings TO authenticated;
