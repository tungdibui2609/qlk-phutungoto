-- Generically find and fix ALL references to 'systems' to allow deletion

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Loop through all Foreign Keys referencing public.systems
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
          AND ccu.table_name = 'systems'
          AND ccu.table_schema = 'public'
    LOOP
        
        -- Get the referenced column name (Parent Column)
        DECLARE
            parent_col TEXT;
        BEGIN
            SELECT kcu.column_name INTO parent_col
            FROM information_schema.referential_constraints AS rc
            JOIN information_schema.key_column_usage AS kcu
              ON rc.unique_constraint_name = kcu.constraint_name
              AND rc.unique_constraint_schema = kcu.constraint_schema
            WHERE rc.constraint_name = r.constraint_name
            LIMIT 1;

            -- Fallback if not found (shouldn't happen for valid FK)
            IF parent_col IS NULL THEN
                parent_col := 'id'; 
            END IF;

            EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
            EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.systems(%I) ON DELETE CASCADE', 
                r.table_name, r.constraint_name, r.column_name, parent_col);
                
            RAISE NOTICE 'Updated % . % to CASCADE (Referencing systems . %)', r.table_name, r.column_name, parent_col;
        END;
        
    END LOOP;
END $$;
