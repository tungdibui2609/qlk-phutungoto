-- Create production_code_levels table
CREATE TABLE IF NOT EXISTS public.production_code_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    level INTEGER NOT NULL,
    prefix TEXT NOT NULL,
    description TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    system_code TEXT DEFAULT 'SANXUAT',
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE
);

-- ENABLE RLS
ALTER TABLE public.production_code_levels ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY "Users can view production_code_levels for their company" ON public.production_code_levels FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can insert production_code_levels for their company" ON public.production_code_levels FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update production_code_levels for their company" ON public.production_code_levels FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can delete production_code_levels for their company" ON public.production_code_levels FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- PUSH TO REALTIME
ALTER TABLE public.production_code_levels REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'production_code_levels') THEN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_code_levels; END IF;
    END IF;
END $$;
