-- Create work_areas table
CREATE TABLE IF NOT EXISTS public.work_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    system_code TEXT, -- Weak reference to systems.code
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.work_areas ENABLE ROW LEVEL SECURITY;

-- Create policies (Multi-tenant)
CREATE POLICY "Users can view work areas for their company" ON public.work_areas 
FOR SELECT USING (
    company_id IN (
        SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can insert work areas for their company" ON public.work_areas 
FOR INSERT WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can update work areas for their company" ON public.work_areas 
FOR UPDATE USING (
    company_id IN (
        SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can delete work areas for their company" ON public.work_areas 
FOR DELETE USING (
    company_id IN (
        SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    )
);

-- Enable Realtime
ALTER TABLE public.work_areas REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'work_areas'
    ) THEN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.work_areas;
        END IF;
    END IF;
END $$;
