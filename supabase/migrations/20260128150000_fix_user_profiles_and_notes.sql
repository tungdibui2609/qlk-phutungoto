-- Fix User Profiles and Self-Referencing Foreign Keys

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Fix 'operational_notes' self-reference (parent_id) -> CASCADE
    -- This ensures that when we delete a note (e.g. by company), its children are also deleted.
    -- Without this, deleteByCompany('operational_notes') might fail if there are threads.
    
    -- Find constraint name for parent_id
    SELECT tc.constraint_name INTO r
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'operational_notes'
      AND kcu.column_name = 'parent_id'
      AND tc.constraint_type = 'FOREIGN KEY'
    LIMIT 1;

    IF r.constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.operational_notes DROP CONSTRAINT %I', r.constraint_name);
        EXECUTE format('ALTER TABLE public.operational_notes ADD CONSTRAINT %I FOREIGN KEY (parent_id) REFERENCES public.operational_notes(id) ON DELETE CASCADE', r.constraint_name);
        RAISE NOTICE 'Updated operational_notes.parent_id to CASCADE';
    END IF;

    -- 2. Fix 'operational_notes' -> 'user_profiles' (user_id) -> CASCADE
    -- Since user_id is NOT NULL, we must CASCADE.
    SELECT tc.constraint_name INTO r
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'operational_notes'
      AND kcu.column_name = 'user_id'
      AND tc.constraint_type = 'FOREIGN KEY'
    LIMIT 1;

    IF r.constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.operational_notes DROP CONSTRAINT %I', r.constraint_name);
        EXECUTE format('ALTER TABLE public.operational_notes ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE', r.constraint_name);
        RAISE NOTICE 'Updated operational_notes.user_id to CASCADE';
    END IF;

    -- 3. Fix 'inventory_checks' -> 'user_profiles' (created_by) -> SET NULL
    -- created_by is nullable, so we prefer SET NULL to keep the history if possible (though company delete wipes it anyway).
    -- But to allow user deletion without company deletion, SET NULL is best.
    SELECT tc.constraint_name INTO r
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'inventory_checks'
      AND kcu.column_name = 'created_by'
      AND tc.constraint_type = 'FOREIGN KEY'
    LIMIT 1;

    IF r.constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.inventory_checks DROP CONSTRAINT %I', r.constraint_name);
        EXECUTE format('ALTER TABLE public.inventory_checks ADD CONSTRAINT %I FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL', r.constraint_name);
        RAISE NOTICE 'Updated inventory_checks.created_by to SET NULL';
    END IF;

END $$;
