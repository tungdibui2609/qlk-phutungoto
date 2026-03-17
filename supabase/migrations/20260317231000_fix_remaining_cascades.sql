-- Migration: Fix Remaining Cascades & Data Integrity
-- Updates constraints for tables that were blocking deletions (like Lots)

DO $$
BEGIN
    -- 1. Fix material_requisition_lines lot_id FK
    -- (Update to SET NULL so deleting a lot doesn't crash the requisition history)
    DECLARE
        cons_name TEXT;
    BEGIN
        SELECT tc.constraint_name INTO cons_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'material_requisition_lines' AND kcu.column_name = 'lot_id' AND tc.constraint_type = 'FOREIGN KEY';
        
        IF cons_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.material_requisition_lines DROP CONSTRAINT %I', cons_name);
            ALTER TABLE public.material_requisition_lines 
            ADD CONSTRAINT material_requisition_lines_lot_id_fkey 
            FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE SET NULL;
        END IF;
    END;

    -- 2. Fix production_records lot_id FK
    DECLARE
        cons_name TEXT;
    BEGIN
        SELECT tc.constraint_name INTO cons_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'production_records' AND kcu.column_name = 'lot_id' AND tc.constraint_type = 'FOREIGN KEY';
        
        IF cons_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.production_records DROP CONSTRAINT %I', cons_name);
            ALTER TABLE public.production_records 
            ADD CONSTRAINT production_records_lot_id_fkey 
            FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE SET NULL;
        END IF;
    END;

    -- 3. Ensure inventory_check_items have CASCADE
    DECLARE
        cons_name TEXT;
    BEGIN
        SELECT tc.constraint_name INTO cons_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'inventory_check_items' AND kcu.column_name = 'lot_id' AND tc.constraint_type = 'FOREIGN KEY';
        
        IF cons_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.inventory_check_items DROP CONSTRAINT %I', cons_name);
        END IF;
        ALTER TABLE public.inventory_check_items 
        ADD CONSTRAINT inventory_check_items_lot_id_fkey 
        FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE CASCADE;
    END;

    -- 4. Fix audit_logs changed_by FK (to auth.users)
    -- This is generally fine but good to verify it allows SET NULL if user is deleted
    DECLARE
        cons_name TEXT;
    BEGIN
        SELECT tc.constraint_name INTO cons_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'audit_logs' AND kcu.column_name = 'changed_by' AND tc.constraint_type = 'FOREIGN KEY';
        
        IF cons_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.audit_logs DROP CONSTRAINT %I', cons_name);
            ALTER TABLE public.audit_logs 
            ADD CONSTRAINT audit_logs_changed_by_fkey 
            FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
        END IF;
    END;

END $$;
