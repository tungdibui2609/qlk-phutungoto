-- Migration: Add `quantity_per_pallet` and `pallet_unit` columns to `products` table
ALTER TABLE public.products ADD COLUMN quantity_per_pallet integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN pallet_unit text;

COMMENT ON COLUMN public.products.quantity_per_pallet IS 'Số lượng sản phẩm tối đa trên mỗi Pallet';
COMMENT ON COLUMN public.products.pallet_unit IS 'Đơn vị tính dùng cho cấu hình Pallet';
