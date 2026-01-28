-- Add company_id to all relevant tables and link to the default company

-- 1. Function to safely add company_id if it doesn't exist
CREATE OR REPLACE FUNCTION add_company_id_to_table(tbl_name TEXT)
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
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. List of tables to update
DO $$
DECLARE
    t TEXT;
    default_company_id UUID;
BEGIN
    -- Get the default company ID
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;

    FOR t IN SELECT unnest(ARRAY[
        'user_profiles',
        'systems',
        'products',
        'categories',
        'customers',
        'suppliers',
        'units',
        'inbound_orders',
        'outbound_orders',
        'qc_info',
        'vehicles',
        'operational_notes',
        'system_configs'
    ]) LOOP
        PERFORM add_company_id_to_table(t);
        
        -- Link existing records to the default company
        EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', t, default_company_id);
    END LOOP;
END $$;

-- 3. Cleanup function
DROP FUNCTION add_company_id_to_table(TEXT);
