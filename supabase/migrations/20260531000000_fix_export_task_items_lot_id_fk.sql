-- Migration: Fix export_task_items lot_id foreign key constraint
-- Goal: Ensure that when a LOT is deleted, any export tasks referencing it are not broken,
-- but instead have their lot_id safely set to NULL (ON DELETE SET NULL).
-- This resolves the "delete lot error" due to foreign key violations.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Find and drop any existing Foreign Key constraints on lot_id column in export_task_items table
    FOR r IN (
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'export_task_items'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'lot_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.export_task_items DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
        RAISE NOTICE 'Dropped foreign key constraint: % on export_task_items(lot_id)', r.constraint_name;
    END LOOP;
END $$;

-- 2. Create the robust foreign key with ON DELETE SET NULL
ALTER TABLE public.export_task_items
ADD CONSTRAINT export_task_items_lot_id_fkey
FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT export_task_items_lot_id_fkey ON public.export_task_items IS 'Safely set lot_id to NULL when the referenced lot is deleted';
