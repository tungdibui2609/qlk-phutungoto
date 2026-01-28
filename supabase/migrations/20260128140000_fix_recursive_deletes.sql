-- Fix recursive delete issues by enabling CASCADE on child tables

DO $$
DECLARE
    r RECORD;
    t TEXT;
BEGIN
    -- 1. Ensure 'lots' has company_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lots' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE public.lots ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
        -- Backfill company_id from products
        UPDATE public.lots l
        SET company_id = p.company_id
        FROM public.products p
        WHERE l.product_id = p.id
        AND l.company_id IS NULL;
    END IF;

    -- 2. List of Child -> Parent relationships to update to CASCADE
    -- Format: child_table, parent_table, fk_column
    CREATE TEMP TABLE IF NOT EXISTS temp_cascade_fix (
        child_table TEXT,
        parent_table TEXT,
        fk_column TEXT
    );
    
    DELETE FROM temp_cascade_fix; -- specific cleanup for rerums

    INSERT INTO temp_cascade_fix (child_table, parent_table, fk_column) VALUES
    ('inbound_order_items', 'inbound_orders', 'order_id'), -- Check column name usually order_id or inbound_order_id
    ('outbound_order_items', 'outbound_orders', 'order_id'),
    ('lots', 'products', 'product_id'),
    ('lot_items', 'lots', 'lot_id'),
    ('lot_splits', 'lots', 'original_lot_id'),
    ('lot_splits', 'lots', 'new_lot_id'); 
    -- Add generic check for tables that might use different column names logic below if needed
    
    -- Iterate and Fix
    FOR r IN SELECT * FROM temp_cascade_fix LOOP
        -- Check if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = r.child_table) THEN
            
            -- Find the specific constraint
            DECLARE
                constraint_n TEXT;
            BEGIN
                SELECT tc.constraint_name INTO constraint_n
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
                  AND tc.table_name = r.child_table
                  AND kcu.column_name = r.fk_column
                LIMIT 1;

                IF constraint_n IS NOT NULL THEN
                    -- Drop and Recreate
                    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.child_table, constraint_n);
                    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE CASCADE', 
                        r.child_table, constraint_n, r.fk_column, r.parent_table);
                    
                    RAISE NOTICE 'Updated % -> % constraint to CASCADE', r.child_table, r.parent_table;
                END IF;
            END;
        END IF;
    END LOOP;
    
    DROP TABLE temp_cascade_fix;
END $$;
