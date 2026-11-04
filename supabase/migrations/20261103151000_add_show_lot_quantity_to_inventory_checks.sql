-- Migration: Add show_lot_quantity to inventory_checks
-- Cho phép tùy chọn hiển thị số lượng tồn theo LOT của sản phẩm khi kiểm kê
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'inventory_checks' 
          AND column_name = 'show_lot_quantity'
    ) THEN
        ALTER TABLE public.inventory_checks 
        ADD COLUMN show_lot_quantity BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

