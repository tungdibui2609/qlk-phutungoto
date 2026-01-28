-- Generically find and fix ALL references to 'company_settings' and ensure it deletes with company

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Scan for FKs referencing company_settings (if any exists, usually none but good to verify)
    FOR r IN 
        SELECT 
            tc.constraint_name, 
            tc.table_name, 
            kcu.column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name = 'company_settings'
          AND ccu.table_schema = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.company_settings(id) ON DELETE CASCADE', 
            r.table_name, r.constraint_name, r.column_name);
        RAISE NOTICE 'Updated % . % to CASCADE (Referencing company_settings)', r.table_name, r.column_name;
    END LOOP;

    -- 2. Ensure company_settings itself deletes when company is deleted
    -- Check FK from company_settings -> companies
    -- It likely has 'id' or 'company_id' referencing companies(id)
    
    FOR r IN 
        SELECT 
            tc.constraint_name, 
            tc.table_name, 
            kcu.column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'company_settings'
          AND ccu.table_name = 'companies'
    LOOP
        EXECUTE format('ALTER TABLE public.company_settings DROP CONSTRAINT %I', r.constraint_name);
        EXECUTE format('ALTER TABLE public.company_settings ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.companies(id) ON DELETE CASCADE', 
            r.constraint_name, r.column_name);
        RAISE NOTICE 'Updated company_settings . % to CASCADE (Referencing companies)', r.column_name;
    END LOOP;

END $$;
