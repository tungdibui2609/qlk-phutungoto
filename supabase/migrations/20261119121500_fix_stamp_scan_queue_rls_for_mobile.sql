-- Migration: Cấp quyền RLS cho mobile app và scanner PWA trên stamp_scan_queue và company_ai_settings
-- Đảm bảo không bị chặn khi mobile app ở chế độ anon / offline sync / token refresh chậm

BEGIN;

-- Cấp quyền execute hàm helper cho anon để tránh lỗi permission denied trong RLS evaluation
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO anon, authenticated, service_role;

-- 1. Bảng stamp_scan_queue: Cho phép cả authenticated và anon (public)
DROP POLICY IF EXISTS "stamp_scan_queue_select" ON public.stamp_scan_queue;
CREATE POLICY "stamp_scan_queue_select"
    ON public.stamp_scan_queue
    FOR SELECT
    TO public
    USING (
        (SELECT auth.role()) = 'anon'
        OR current_user = 'anon'
        OR company_id = (SELECT public.get_user_company_id())
        OR company_id IS NULL
    );

DROP POLICY IF EXISTS "stamp_scan_queue_insert" ON public.stamp_scan_queue;
CREATE POLICY "stamp_scan_queue_insert"
    ON public.stamp_scan_queue
    FOR INSERT
    TO public
    WITH CHECK (
        (SELECT auth.role()) = 'anon'
        OR current_user = 'anon'
        OR company_id = (SELECT public.get_user_company_id())
        OR company_id IS NULL
    );

DROP POLICY IF EXISTS "stamp_scan_queue_update" ON public.stamp_scan_queue;
CREATE POLICY "stamp_scan_queue_update"
    ON public.stamp_scan_queue
    FOR UPDATE
    TO public
    USING (
        (SELECT auth.role()) = 'anon'
        OR current_user = 'anon'
        OR company_id = (SELECT public.get_user_company_id())
        OR company_id IS NULL
    )
    WITH CHECK (
        (SELECT auth.role()) = 'anon'
        OR current_user = 'anon'
        OR company_id = (SELECT public.get_user_company_id())
        OR company_id IS NULL
    );

DROP POLICY IF EXISTS "stamp_scan_queue_delete" ON public.stamp_scan_queue;
CREATE POLICY "stamp_scan_queue_delete"
    ON public.stamp_scan_queue
    FOR DELETE
    TO public
    USING (
        (SELECT auth.role()) = 'anon'
        OR current_user = 'anon'
        OR company_id = (SELECT public.get_user_company_id())
        OR company_id IS NULL
    );

-- 2. Bảng company_ai_settings: Cho phép mobile app / scanner đọc cấu hình (SELECT)
DROP POLICY IF EXISTS "company_ai_settings_select" ON public.company_ai_settings;
CREATE POLICY "company_ai_settings_select"
    ON public.company_ai_settings
    FOR SELECT
    TO public
    USING (
        (SELECT auth.role()) = 'anon'
        OR current_user = 'anon'
        OR company_id = (SELECT public.get_user_company_id())
        OR company_id IS NULL
    );

-- INSERT / UPDATE / DELETE cho company_ai_settings vẫn giữ nguyên authenticated để bảo mật
DROP POLICY IF EXISTS "company_ai_settings_insert" ON public.company_ai_settings;
CREATE POLICY "company_ai_settings_insert"
    ON public.company_ai_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (company_id = (SELECT public.get_user_company_id()));

DROP POLICY IF EXISTS "company_ai_settings_update" ON public.company_ai_settings;
CREATE POLICY "company_ai_settings_update"
    ON public.company_ai_settings
    FOR UPDATE
    TO authenticated
    USING (company_id = (SELECT public.get_user_company_id()))
    WITH CHECK (company_id = (SELECT public.get_user_company_id()));

DROP POLICY IF EXISTS "company_ai_settings_delete" ON public.company_ai_settings;
CREATE POLICY "company_ai_settings_delete"
    ON public.company_ai_settings
    FOR DELETE
    TO authenticated
    USING (company_id = (SELECT public.get_user_company_id()));

COMMIT;
