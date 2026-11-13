-- Create warehouse_position_proposals table
CREATE TABLE IF NOT EXISTS public.warehouse_position_proposals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT,
    system_code TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    title TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_by_name TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PARTIAL')),
    total_positions INTEGER NOT NULL DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    approved_by_name TEXT,
    approved_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_warehouse_proposals_system_code ON public.warehouse_position_proposals(system_code);
CREATE INDEX IF NOT EXISTS idx_warehouse_proposals_status ON public.warehouse_position_proposals(status);
CREATE INDEX IF NOT EXISTS idx_warehouse_proposals_created_at ON public.warehouse_position_proposals(created_at DESC);

-- Enable RLS
ALTER TABLE public.warehouse_position_proposals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'warehouse_position_proposals' AND policyname = 'Enable all access for authenticated and anon users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated and anon users"
        ON public.warehouse_position_proposals
        FOR ALL
        TO authenticated, anon
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

