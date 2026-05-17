-- Migration: Sửa RLS policies cho delivery_settings và delivery_journal
-- Vấn đề: Dùng public.profiles thay vì public.user_profiles
-- Kết quả: POST /api/delivery-settings bị 500 do RLS từ chối INSERT

-- ========== DELIVERY_SETTINGS ==========
DROP POLICY IF EXISTS "Users can view delivery_settings in their company" ON public.delivery_settings;
CREATE POLICY "Users can view delivery_settings in their company" ON public.delivery_settings
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert delivery_settings" ON public.delivery_settings;
CREATE POLICY "Users can insert delivery_settings" ON public.delivery_settings
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update delivery_settings" ON public.delivery_settings;
CREATE POLICY "Users can update delivery_settings" ON public.delivery_settings
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete delivery_settings" ON public.delivery_settings;
CREATE POLICY "Users can delete delivery_settings" ON public.delivery_settings
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

-- ========== DELIVERY_JOURNAL ==========
DROP POLICY IF EXISTS "Users can view delivery journal in their company" ON public.delivery_journal;
CREATE POLICY "Users can view delivery journal in their company" ON public.delivery_journal
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create delivery journal" ON public.delivery_journal;
CREATE POLICY "Users can create delivery journal" ON public.delivery_journal
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update delivery journal" ON public.delivery_journal;
CREATE POLICY "Users can update delivery journal" ON public.delivery_journal
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete delivery journal" ON public.delivery_journal;
CREATE POLICY "Users can delete delivery journal" ON public.delivery_journal
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        )
    );