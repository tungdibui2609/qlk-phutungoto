-- Migration: Sửa toàn bộ lỗi schema module delivery
-- 1. delivery_settings: FK mo_id từ manufacturing_orders → productions
-- 2. delivery_settings + delivery_journal: RLS dùng profiles → user_profiles
-- 3. Thêm production_lot_id nếu thiếu

-- ========== SỬA DELIVERY_SETTINGS ==========

-- 1a. Bỏ FK cũ (manufacturing_orders)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'delivery_settings_mo_id_fkey'
        AND table_name = 'delivery_settings'
    ) THEN
        ALTER TABLE public.delivery_settings DROP CONSTRAINT delivery_settings_mo_id_fkey;
    END IF;
END $$;

-- 1b. Tạo FK mới sang productions (nếu cột mo_id đã là UUID)
-- Trước tiên đảm bảo cột mo_id là UUID
ALTER TABLE public.delivery_settings 
    ALTER COLUMN mo_id TYPE UUID USING mo_id::UUID;

-- Thêm FK mới (dùng DO block để tránh lỗi nếu FK đã tồn tại)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'delivery_settings_productions_fkey'
        AND table_name = 'delivery_settings'
    ) THEN
        ALTER TABLE public.delivery_settings
            ADD CONSTRAINT delivery_settings_productions_fkey 
            FOREIGN KEY (mo_id) REFERENCES public.productions(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 1c. Thêm cột production_lot_id
ALTER TABLE public.delivery_settings
    ADD COLUMN IF NOT EXISTS production_lot_id UUID;

-- FK cho production_lot_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'delivery_settings_production_lot_fkey'
        AND table_name = 'delivery_settings'
    ) THEN
        ALTER TABLE public.delivery_settings
            ADD CONSTRAINT delivery_settings_production_lot_fkey 
            FOREIGN KEY (production_lot_id) REFERENCES public.production_lots(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_settings_lot_id ON public.delivery_settings(production_lot_id);

-- ========== SỬA RLS: profiles → user_profiles ==========

-- Delivery settings policies
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

-- Delivery journal policies (sửa từ profiles → user_profiles)
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

-- ========== ENABLE REALTIME ==========

ALTER TABLE public.delivery_settings REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'delivery_settings'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_settings;
    END IF;
END $$;