-- Tạo bảng hàng đợi ảnh dấu mực (stamp_scan_queue) và cấu hình Gemini AI theo công ty (company_ai_settings)

CREATE TABLE IF NOT EXISTS public.stamp_scan_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid DEFAULT public.get_user_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    system_code text NOT NULL DEFAULT 'KHO_DONG_LANH',
    pallet_stt text NOT NULL,
    pallet_tag text,
    pallet_notes text,
    box_count integer NOT NULL DEFAULT 30,
    box_weight numeric NOT NULL DEFAULT 20,
    image_url text NOT NULL,
    stamp_line1 text,
    stamp_line2 text,
    decoded_json jsonb,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'decoded', 'approved', 'error')),
    error_message text,
    created_by uuid,
    created_by_name text,
    approved_by uuid,
    approved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_stamp_scan_queue_company_sys_status
    ON public.stamp_scan_queue (company_id, system_code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stamp_scan_queue_pallet_stt
    ON public.stamp_scan_queue (pallet_stt);

ALTER TABLE public.stamp_scan_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stamp_scan_queue_select" ON public.stamp_scan_queue;
CREATE POLICY "stamp_scan_queue_select"
    ON public.stamp_scan_queue
    FOR SELECT
    TO authenticated
    USING (company_id = public.get_user_company_id() OR company_id IS NULL);

DROP POLICY IF EXISTS "stamp_scan_queue_insert" ON public.stamp_scan_queue;
CREATE POLICY "stamp_scan_queue_insert"
    ON public.stamp_scan_queue
    FOR INSERT
    TO authenticated
    WITH CHECK (company_id = public.get_user_company_id() OR company_id IS NULL);

DROP POLICY IF EXISTS "stamp_scan_queue_update" ON public.stamp_scan_queue;
CREATE POLICY "stamp_scan_queue_update"
    ON public.stamp_scan_queue
    FOR UPDATE
    TO authenticated
    USING (company_id = public.get_user_company_id() OR company_id IS NULL)
    WITH CHECK (company_id = public.get_user_company_id() OR company_id IS NULL);

DROP POLICY IF EXISTS "stamp_scan_queue_delete" ON public.stamp_scan_queue;
CREATE POLICY "stamp_scan_queue_delete"
    ON public.stamp_scan_queue
    FOR DELETE
    TO authenticated
    USING (company_id = public.get_user_company_id() OR company_id IS NULL);

-- Bảng cấu hình Gemini AI Key theo công ty (kích hoạt trên Web Mẹ)
CREATE TABLE IF NOT EXISTS public.company_ai_settings (
    company_id uuid PRIMARY KEY DEFAULT public.get_user_company_id() REFERENCES public.companies(id) ON DELETE CASCADE,
    gemini_api_key text,
    gemini_model text NOT NULL DEFAULT 'gemini-2.5-flash',
    is_enabled boolean NOT NULL DEFAULT true,
    updated_by uuid,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.company_ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_ai_settings_select" ON public.company_ai_settings;
CREATE POLICY "company_ai_settings_select"
    ON public.company_ai_settings
    FOR SELECT
    TO authenticated
    USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "company_ai_settings_insert" ON public.company_ai_settings;
CREATE POLICY "company_ai_settings_insert"
    ON public.company_ai_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "company_ai_settings_update" ON public.company_ai_settings;
CREATE POLICY "company_ai_settings_update"
    ON public.company_ai_settings
    FOR UPDATE
    TO authenticated
    USING (company_id = public.get_user_company_id())
    WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "company_ai_settings_delete" ON public.company_ai_settings;
CREATE POLICY "company_ai_settings_delete"
    ON public.company_ai_settings
    FOR DELETE
    TO authenticated
    USING (company_id = public.get_user_company_id());

CREATE OR REPLACE FUNCTION public.update_stamp_scan_queue_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_scan_queue_updated_at ON public.stamp_scan_queue;
CREATE TRIGGER trg_stamp_scan_queue_updated_at
    BEFORE UPDATE ON public.stamp_scan_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_stamp_scan_queue_updated_at();
