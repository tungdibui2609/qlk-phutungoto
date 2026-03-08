-- Drop tables if exist (for dev iteration, though normally migrations shouldn't)
-- DROP TABLE IF EXISTS public.manufacturing_orders CASCADE;
-- DROP TABLE IF EXISTS public.bom_lines CASCADE;
-- DROP TABLE IF EXISTS public.boms CASCADE;

-- 1. Create boms table
CREATE TABLE IF NOT EXISTS public.boms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    code TEXT,
    name TEXT NOT NULL,
    quantity NUMERIC DEFAULT 1 NOT NULL, -- Quantity of the product this BOM makes
    system_code TEXT DEFAULT 'SANXUAT',
    notes TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true
);

-- 2. Create bom_lines table
CREATE TABLE IF NOT EXISTS public.bom_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    bom_id UUID REFERENCES public.boms(id) ON DELETE CASCADE NOT NULL,
    material_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    quantity NUMERIC NOT NULL,
    unit TEXT,
    scrap_percentage NUMERIC DEFAULT 0,
    notes TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE
);

-- 3. Create manufacturing_orders table
CREATE TABLE IF NOT EXISTS public.manufacturing_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    code TEXT NOT NULL,
    bom_id UUID REFERENCES public.boms(id),
    product_id UUID REFERENCES public.products(id) NOT NULL,
    target_quantity NUMERIC NOT NULL,
    produced_quantity NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'DRAFT', -- DRAFT, PLANNED, IN_PROGRESS, DONE, CANCELED
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    system_code TEXT DEFAULT 'SANXUAT',
    notes TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE
);

-- ENABLE RLS
ALTER TABLE public.boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_orders ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR boms
CREATE POLICY "Users can view boms for their company" ON public.boms FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can insert boms for their company" ON public.boms FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update boms for their company" ON public.boms FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can delete boms for their company" ON public.boms FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- POLICIES FOR bom_lines
CREATE POLICY "Users can view bom_lines for their company" ON public.bom_lines FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can insert bom_lines for their company" ON public.bom_lines FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update bom_lines for their company" ON public.bom_lines FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can delete bom_lines for their company" ON public.bom_lines FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- POLICIES FOR manufacturing_orders
CREATE POLICY "Users can view manufacturing_orders for their company" ON public.manufacturing_orders FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can insert manufacturing_orders for their company" ON public.manufacturing_orders FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update manufacturing_orders for their company" ON public.manufacturing_orders FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can delete manufacturing_orders for their company" ON public.manufacturing_orders FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- PUSH TO REALTIME
ALTER TABLE public.boms REPLICA IDENTITY FULL;
ALTER TABLE public.bom_lines REPLICA IDENTITY FULL;
ALTER TABLE public.manufacturing_orders REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'boms') THEN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.boms; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bom_lines') THEN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.bom_lines; END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'manufacturing_orders') THEN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.manufacturing_orders; END IF;
    END IF;
END $$;
