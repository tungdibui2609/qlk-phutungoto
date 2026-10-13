-- Migration: Add `boxes_per_container` column to `products` table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS boxes_per_container integer DEFAULT 0;

COMMENT ON COLUMN public.products.boxes_per_container IS 'Tổng số thùng xuất bán 1 container';
