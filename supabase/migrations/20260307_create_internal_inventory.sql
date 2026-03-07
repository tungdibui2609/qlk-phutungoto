-- Create internal inventory sessions table (position-level physical checks)
-- Different from inventory_checks which is lot/product-level accounting audit
CREATE TABLE IF NOT EXISTS public.internal_inventory_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    status text CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
    warehouse_id uuid,
    system_code text NOT NULL,
    company_id uuid,
    created_by uuid,
    created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
    completed_at timestamptz,
    note text
);

-- Create internal inventory items table (per-position check results)
CREATE TABLE IF NOT EXISTS public.internal_inventory_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id uuid REFERENCES public.internal_inventory_sessions(id) ON DELETE CASCADE NOT NULL,
    position_id uuid NOT NULL,
    zone_id uuid,
    checked boolean DEFAULT false,
    note text,
    checked_by uuid,
    checked_at timestamptz,
    lot_id_snapshot uuid,
    created_at timestamptz DEFAULT timezone('utc', now()) NOT NULL,
    UNIQUE (session_id, position_id)
);

-- Foreign keys (safe approach)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'iis_company_id_fkey') THEN
        ALTER TABLE public.internal_inventory_sessions
            ADD CONSTRAINT iis_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'iis_created_by_fkey') THEN
        ALTER TABLE public.internal_inventory_sessions
            ADD CONSTRAINT iis_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'iii_checked_by_fkey') THEN
        ALTER TABLE public.internal_inventory_items
            ADD CONSTRAINT iii_checked_by_fkey FOREIGN KEY (checked_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.internal_inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_inventory_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Enable all for authenticated on internal_inventory_sessions" ON public.internal_inventory_sessions;
CREATE POLICY "Enable all for authenticated on internal_inventory_sessions"
    ON public.internal_inventory_sessions FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all for authenticated on internal_inventory_items" ON public.internal_inventory_items;
CREATE POLICY "Enable all for authenticated on internal_inventory_items"
    ON public.internal_inventory_items FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_iis_system_code ON public.internal_inventory_sessions(system_code);
CREATE INDEX IF NOT EXISTS idx_iis_company_id ON public.internal_inventory_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_iis_status ON public.internal_inventory_sessions(status);
CREATE INDEX IF NOT EXISTS idx_iii_session_id ON public.internal_inventory_items(session_id);
CREATE INDEX IF NOT EXISTS idx_iii_position_id ON public.internal_inventory_items(position_id);
CREATE INDEX IF NOT EXISTS idx_iii_session_position ON public.internal_inventory_items(session_id, position_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_inventory_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_inventory_items;
