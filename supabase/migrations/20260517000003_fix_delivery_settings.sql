-- Migration: Sửa delivery_settings để khớp với schema thực tế
-- Vấn đề: mo_id tham chiếu sai bảng (manufacturing_orders → productions)
-- Thêm: production_lot_id, RLS policies

-- 1. Bỏ FK cũ nếu tồn tại
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

-- 2. Đổi FK mo_id sang productions
ALTER TABLE public.delivery_settings
    ALTER COLUMN mo_id TYPE UUID USING mo_id::UUID,
    ADD CONSTRAINT delivery_settings_mo_id_fkey FOREIGN KEY (mo_id) REFERENCES public.productions(id) ON DELETE CASCADE;

-- 3. Thêm cột production_lot_id nếu chưa có
ALTER TABLE public.delivery_settings
    ADD COLUMN IF NOT EXISTS production_lot_id UUID REFERENCES public.production_lots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_settings_production_lot_id ON public.delivery_settings(production_lot_id);

-- 4. Tạo RLS policies cho delivery_settings
DROP POLICY IF EXISTS "Users can view delivery_settings in their company" ON public.delivery_settings;
CREATE POLICY "Users can view delivery_settings in their company" ON public.delivery_settings
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert delivery_settings" ON public.delivery_settings;
CREATE POLICY "Users can insert delivery_settings" ON public.delivery_settings
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update delivery_settings" ON public.delivery_settings;
CREATE POLICY "Users can update delivery_settings" ON public.delivery_settings
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete delivery_settings" ON public.delivery_settings;
CREATE POLICY "Users can delete delivery_settings" ON public.delivery_settings
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- 5. Enable Realtime cho delivery_settings
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