-- Restore FK for inventory_check_items to lots
-- This ensures data integrity even if we use manual joins in some places.
-- It also allows PostgREST to perform joins if needed in the future.

DO $$
BEGIN
    -- Add FK to lots if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'inventory_check_items_lot_id_fkey') THEN
        ALTER TABLE public.inventory_check_items
        ADD CONSTRAINT inventory_check_items_lot_id_fkey
        FOREIGN KEY (lot_id)
        REFERENCES public.lots(id);
    END IF;

    -- Add FK to lot_items if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'inventory_check_items_lot_item_id_fkey') THEN
        ALTER TABLE public.inventory_check_items
        ADD CONSTRAINT inventory_check_items_lot_item_id_fkey
        FOREIGN KEY (lot_item_id)
        REFERENCES public.lot_items(id);
    END IF;
END $$;
