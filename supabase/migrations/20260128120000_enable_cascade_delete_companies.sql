-- Enable ON DELETE CASCADE for foreign keys referencing companies

DO $$
DECLARE
    r RECORD;
    t TEXT;
BEGIN
    -- List of tables that have company_id foreign key
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
        -- Find the constraint name for company_id referencing companies
        FOR r IN 
            SELECT tc.constraint_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = 'public'
              AND tc.table_name = t
              AND kcu.column_name = 'company_id'
              AND ccu.table_name = 'companies'
        LOOP
            -- Drop the existing constraint
            EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, r.constraint_name);
            
            -- Recreate it with ON DELETE CASCADE
            -- Note: reuse the same constraint name or let Postgres generate one? 
            -- Better to use the same name to keep it clean, but if it was auto-generated, we can rely on that.
            -- Using a straightforward ADD CONSTRAINT with the same name might conflict if not dropped first (which we did).
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE', t, r.constraint_name);
            
            RAISE NOTICE 'Updated constraint % on table % to CASCADE', r.constraint_name, t;
        END LOOP;
    END LOOP;
END $$;
