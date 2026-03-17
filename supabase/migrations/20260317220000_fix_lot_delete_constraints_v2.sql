-- Migration to fix LOT deletion by updating Foreign Key constraints to CASCADE or SET NULL
-- This ensures that when a LOT is deleted, related data is either cleaned up or unlinked safely.

DO $$
BEGIN
    -- 1. Update positions: Set lot_id to NULL when the lot is deleted
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'positions_lot_id_fkey') THEN
        ALTER TABLE public.positions DROP CONSTRAINT positions_lot_id_fkey;
    END IF;
    ALTER TABLE public.positions 
    ADD CONSTRAINT positions_lot_id_fkey 
    FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE SET NULL;

    -- 2. Update inventory_check_items: Delete items when the lot or lot_item is deleted (CASCADE)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'inventory_check_items_lot_id_fkey') THEN
        ALTER TABLE public.inventory_check_items DROP CONSTRAINT inventory_check_items_lot_id_fkey;
    END IF;
    ALTER TABLE public.inventory_check_items 
    ADD CONSTRAINT inventory_check_items_lot_id_fkey 
    FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE CASCADE;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'inventory_check_items_lot_item_id_fkey') THEN
        ALTER TABLE public.inventory_check_items DROP CONSTRAINT inventory_check_items_lot_item_id_fkey;
    END IF;
    ALTER TABLE public.inventory_check_items 
    ADD CONSTRAINT inventory_check_items_lot_item_id_fkey 
    FOREIGN KEY (lot_item_id) REFERENCES public.lot_items(id) ON DELETE CASCADE;

    -- 3. Update material_requisition_lines: Set lot_id to NULL when the lot is deleted
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'material_requisition_lines_lot_id_fkey') THEN
        ALTER TABLE public.material_requisition_lines DROP CONSTRAINT material_requisition_lines_lot_id_fkey;
    ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_requisition_lines_lot_id_fkey') THEN
        ALTER TABLE public.material_requisition_lines DROP CONSTRAINT material_requisition_lines_lot_id_fkey;
    END IF;
    -- Generic check for any FK from this table to lots
    DECLARE
        cons_name TEXT;
    BEGIN
        SELECT tc.constraint_name INTO cons_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'material_requisition_lines' AND kcu.column_name = 'lot_id' AND tc.constraint_type = 'FOREIGN KEY';
        
        IF cons_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.material_requisition_lines DROP CONSTRAINT %I', cons_name);
        END IF;
    END;
    ALTER TABLE public.material_requisition_lines 
    ADD CONSTRAINT material_requisition_lines_lot_id_fkey 
    FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE SET NULL;

    -- 4. Update production_records: Set lot_id to NULL when the lot is deleted
    DECLARE
        cons_name TEXT;
    BEGIN
        SELECT tc.constraint_name INTO cons_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'production_records' AND kcu.column_name = 'lot_id' AND tc.constraint_type = 'FOREIGN KEY';
        
        IF cons_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.production_records DROP CONSTRAINT %I', cons_name);
        END IF;
    END;
    ALTER TABLE public.production_records 
    ADD CONSTRAINT production_records_lot_id_fkey 
    FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE SET NULL;

END $$;
