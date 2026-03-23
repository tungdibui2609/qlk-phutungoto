-- Create productions table for cross-system production information
CREATE TABLE IF NOT EXISTS public.productions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'DRAFT' NOT NULL, -- DRAFT, IN_PROGRESS, DONE, CANCELED
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    
    -- Constraint: Unique code per company
    CONSTRAINT productions_code_company_unique UNIQUE (code, company_id)
);

-- ENABLE RLS
ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;

-- POLICIES
DROP POLICY IF EXISTS "Users can view productions for their company" ON public.productions;
CREATE POLICY "Users can view productions for their company" ON public.productions FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "Users can insert productions for their company" ON public.productions;
CREATE POLICY "Users can insert productions for their company" ON public.productions FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "Users can update productions for their company" ON public.productions;
CREATE POLICY "Users can update productions for their company" ON public.productions FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
DROP POLICY IF EXISTS "Users can delete productions for their company" ON public.productions;
CREATE POLICY "Users can delete productions for their company" ON public.productions FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- PUSH TO REALTIME
ALTER TABLE public.productions REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'productions') THEN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.productions; END IF;
    END IF;
END $$;
