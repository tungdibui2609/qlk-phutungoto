-- Phase 2: Material Requisitions & Production Records

-- 1. Phiếu Yêu Cầu Xuất Nguyên Liệu
CREATE TABLE IF NOT EXISTS public.material_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    mo_id UUID REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, PICKING, DONE, CANCELED
    requested_by UUID REFERENCES auth.users(id),
    notes TEXT,
    system_code TEXT DEFAULT 'SANXUAT',
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE
);

-- 2. Dòng chi tiết Phiếu Xuất NL (NVL cụ thể cần xuất)
CREATE TABLE IF NOT EXISTS public.material_requisition_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    requisition_id UUID REFERENCES public.material_requisitions(id) ON DELETE CASCADE NOT NULL,
    material_id UUID REFERENCES public.products(id) NOT NULL,
    required_quantity NUMERIC NOT NULL,
    issued_quantity NUMERIC DEFAULT 0, -- Số lượng Kho đã xuất thực tế
    unit TEXT,
    lot_id UUID REFERENCES public.lots(id), -- LOT cụ thể đã xuất (nếu có)
    notes TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE
);

-- 3. Ghi nhận Sản lượng (Production Records)
CREATE TABLE IF NOT EXISTS public.production_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    mo_id UUID REFERENCES public.manufacturing_orders(id) ON DELETE CASCADE NOT NULL,
    record_type TEXT NOT NULL, -- PRODUCE (thành phẩm), SCRAP (phế phẩm)
    product_id UUID REFERENCES public.products(id) NOT NULL,
    quantity NUMERIC NOT NULL,
    unit TEXT,
    lot_id UUID REFERENCES public.lots(id), -- LOT thành phẩm vừa tạo (nếu có)
    recorded_by UUID REFERENCES auth.users(id),
    notes TEXT,
    system_code TEXT DEFAULT 'SANXUAT',
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE
);

-- ENABLE RLS
ALTER TABLE public.material_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requisition_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_records ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR material_requisitions
CREATE POLICY "Users can view material_requisitions for their company" ON public.material_requisitions FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can insert material_requisitions for their company" ON public.material_requisitions FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update material_requisitions for their company" ON public.material_requisitions FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can delete material_requisitions for their company" ON public.material_requisitions FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- POLICIES FOR material_requisition_lines
CREATE POLICY "Users can view material_requisition_lines for their company" ON public.material_requisition_lines FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can insert material_requisition_lines for their company" ON public.material_requisition_lines FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update material_requisition_lines for their company" ON public.material_requisition_lines FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can delete material_requisition_lines for their company" ON public.material_requisition_lines FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- POLICIES FOR production_records
CREATE POLICY "Users can view production_records for their company" ON public.production_records FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can insert production_records for their company" ON public.production_records FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update production_records for their company" ON public.production_records FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can delete production_records for their company" ON public.production_records FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- PUSH TO REALTIME
ALTER TABLE public.material_requisitions REPLICA IDENTITY FULL;
ALTER TABLE public.material_requisition_lines REPLICA IDENTITY FULL;
ALTER TABLE public.production_records REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'material_requisitions') THEN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.material_requisitions; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'material_requisition_lines') THEN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.material_requisition_lines; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'production_records') THEN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_records; END IF;
    END IF;
END $$;
