-- TOTAL SWEEP: Add company_id and CASCADE DELETE to remaining tables
-- Targets: roles, permissions, positions, zone_templates, zone_layouts, product_units

DO $$
DECLARE
    default_company_id UUID;
    t TEXT;
BEGIN
    -- 0. Get a default company for backfilling
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;

    -- 1. List of tables to process
    FOR t IN SELECT unnest(ARRAY[
        'roles',
        'permissions',
        'positions',
        'zone_templates',
        'zone_layouts',
        'product_units' 
    ]) LOOP
        
        -- A. Add company_id column if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'company_id') THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN company_id UUID', t);
            RAISE NOTICE 'Added company_id to %', t;
        END IF;

        -- B. Backfill with default company (CAREFUL WITH SYSTEM SHARED DATA)
        IF default_company_id IS NOT NULL THEN
            IF t = 'roles' THEN
                -- Don't backfill system roles
                EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL AND is_system = false', t, default_company_id);
            ELSE
                 -- For other tables, assume they are tenant-specific if existing. 
                 -- If there are shared templates, we might want to skip them too, but schema doesn't show is_system flag for most.
                 -- Let's be safe: If table has 'is_system' or 'system_code' maybe we check? 
                 -- For now, we backfill everything to be safe against data loss, except roles.
                EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', t, default_company_id);
            END IF;
        END IF;

        -- D. Add Foreign Key with CASCADE
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = format('fk_%s_company_cascade', t) 
            AND table_name = t
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT fk_%s_company_cascade FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE', t, t);
        END IF;

        -- E. Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

        -- F. Add default policy (Strict but allows NULL for Shared Data)
        EXECUTE format('DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Strict Tenant Boundary" ON public.%I AS RESTRICTIVE FOR ALL USING (
                (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1))
                OR
                (auth.jwt() ->> ''email'' = ''tungdibui2609@gmail.com'')
                OR
                (company_id IS NULL) -- THIS IS CRITICAL: Allows viewing shared system data
             )',
             t
        );
        
        -- G. Add Permissive Policy
        EXECUTE format('DROP POLICY IF EXISTS "Permissive Access" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Permissive Access" ON public.%I FOR ALL TO authenticated USING (true)', t);

    END LOOP;

    -- Special handling for product_media
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_media' AND column_name = 'company_id') THEN
       ALTER TABLE public.product_media ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
       IF default_company_id IS NOT NULL THEN
            UPDATE public.product_media SET company_id = default_company_id WHERE company_id IS NULL;
       END IF;
    END IF;

END $$;
