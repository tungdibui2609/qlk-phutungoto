-- Migration: Add append_to_product_name to master_tags
-- Cờ cho phép gắn kèm mã tag vào tên sản phẩm của Lot (VD: Đô Na A (TRUNG HÙNG))
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
          AND table_name = 'master_tags' 
          AND column_name = 'append_to_product_name'
    ) THEN
        ALTER TABLE public.master_tags 
        ADD COLUMN append_to_product_name BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

