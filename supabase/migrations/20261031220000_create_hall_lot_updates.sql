-- Create hall_lot_updates table
CREATE TABLE IF NOT EXISTS public.hall_lot_updates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    system_code TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    hall_id TEXT,
    hall_name TEXT NOT NULL,
    lot_seqs JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_lots INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_by_name TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hall_lot_updates_system_code ON public.hall_lot_updates(system_code);
CREATE INDEX IF NOT EXISTS idx_hall_lot_updates_created_at ON public.hall_lot_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hall_lot_updates_hall_name ON public.hall_lot_updates(hall_name);

-- RLS
ALTER TABLE public.hall_lot_updates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'hall_lot_updates' AND policyname = 'Enable all access for authenticated and anon users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated and anon users"
        ON public.hall_lot_updates
        FOR ALL
        TO authenticated, anon
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

