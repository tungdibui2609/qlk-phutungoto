-- SECURE INVENTORY & INFRASTRUCTURE TENANCY
-- This script adds company_id to inventory/warehouse tables and enforces strict RLS.

BEGIN;

-- 1. Helper Function to add company_id safely
CREATE OR REPLACE FUNCTION add_company_id_to_table_v2(tbl_name TEXT)
RETURNS VOID AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = tbl_name
        AND column_name = 'company_id'
    ) THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN company_id UUID REFERENCES public.companies(id)', tbl_name);
        RAISE NOTICE 'Added company_id to %', tbl_name;
    ELSE
        RAISE NOTICE 'company_id already exists on %', tbl_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Add company_id to tables
DO $$
DECLARE
    t TEXT;
    default_company_id UUID;
BEGIN
    -- Get the default company ID (anywarehouse)
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;

    -- Safety check: if no default company, we can't backfill properly, but we should proceed with schema change
    -- In a real scenario we might abort, but here we assume 'anywarehouse' exists or we leave nulls if not.

    FOR t IN SELECT unnest(ARRAY[
        'branches',
        'warehouses',
        'zones',
        'locations',
        'lots',
        'inventory_checks',
        'inventory_check_items'
    ]) LOOP
        -- A. Add Column
        PERFORM add_company_id_to_table_v2(t);

        -- B. Backfill Data (Assign orphans to default company)
        IF default_company_id IS NOT NULL THEN
            EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', t, default_company_id);
        END IF;

        -- C. Enforce Row Level Security
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

        -- D. Clean up old insecure policies (Best effort)
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users on %I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can select %I" ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "Enable read access for all users" ON public.%I', t, t);

        -- E. Create PERMISSIVE policy (Base access)
        -- We need at least one permissive policy for RLS to allow anything.
        -- Standard pattern: Allow access if you are authenticated (and let Restrictive filter it)
        -- OR defining the positive logic here.
        -- Let's stick to the project's "Restrictive" pattern:
        -- 1. Permissive: "Allow All Authenticated" (Broad)
        -- 2. Restrictive: "Filter by Company" (Narrow)

        EXECUTE format('DROP POLICY IF EXISTS "Permissive Access" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Permissive Access" ON public.%I FOR ALL TO authenticated USING (true)', t);

        -- F. Create RESTRICTIVE policy (Isolation)
        EXECUTE format('DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Strict Tenant Boundary" ON public.%I AS RESTRICTIVE FOR ALL USING (
                (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1))
                OR
                (auth.jwt() ->> ''email'' = ''tungdibui2609@gmail.com'')
                OR
                (company_id IS NULL) -- Allow shared data if intentionally null (though we backfilled)
             )',
             t
        );

    END LOOP;
END $$;

-- 3. Cleanup
DROP FUNCTION add_company_id_to_table_v2(TEXT);

COMMIT;
