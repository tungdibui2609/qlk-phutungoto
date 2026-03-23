-- Upgrade productions table with more fields
ALTER TABLE public.productions
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS weight_per_unit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS target_system_code TEXT;

-- Create production_lots table for multiple lots per production
CREATE TABLE IF NOT EXISTS public.production_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    production_id UUID REFERENCES public.productions(id) ON DELETE CASCADE NOT NULL,
    lot_code TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL
);

-- ENABLE RLS
ALTER TABLE public.production_lots ENABLE ROW LEVEL SECURITY;

-- POLICIES
DROP POLICY IF EXISTS "Users can view production_lots for their company" ON public.production_lots;
CREATE POLICY "Users can view production_lots for their company" ON public.production_lots FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "Users can insert production_lots for their company" ON public.production_lots;
CREATE POLICY "Users can insert production_lots for their company" ON public.production_lots FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "Users can update production_lots for their company" ON public.production_lots;
CREATE POLICY "Users can update production_lots for their company" ON public.production_lots FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "Users can delete production_lots for their company" ON public.production_lots;
CREATE POLICY "Users can delete production_lots for their company" ON public.production_lots FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- PUSH TO REALTIME
ALTER TABLE public.production_lots REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'production_lots') THEN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_lots; END IF;
    END IF;
END $$;
