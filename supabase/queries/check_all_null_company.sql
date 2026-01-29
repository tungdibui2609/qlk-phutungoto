-- =============================================================================
-- DIAGNOSTIC V2: FIND ALL TABLES WITH NULL COMPANY_ID (Visible Results)
-- =============================================================================

-- Create a temporary function to scan tables and return rows
CREATE OR REPLACE FUNCTION check_global_data_scan()
RETURNS TABLE(table_name text, orphan_count bigint) AS $$
DECLARE
    t_name text;
    count_val bigint;
BEGIN
    -- Loop through all tables that have a 'company_id' column
    FOR t_name IN 
        SELECT c.table_name 
        FROM information_schema.columns c
        WHERE c.column_name = 'company_id' 
        AND c.table_schema = 'public'
    LOOP
        -- Count rows where company_id is NULL
        EXECUTE format('SELECT count(*) FROM %I WHERE company_id IS NULL', t_name) INTO count_val;
        
        -- If found, add to result list
        IF count_val > 0 THEN
            table_name := t_name;
            orphan_count := count_val;
            RETURN NEXT;
        END IF;
    END LOOP;
    
    -- If no data found at all, we return nothing (empty table means clean)
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT * FROM check_global_data_scan();

-- Clean up
DROP FUNCTION check_global_data_scan();
