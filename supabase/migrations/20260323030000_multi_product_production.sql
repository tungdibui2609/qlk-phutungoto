-- Upgrade production_lots to support per-item products and weight
ALTER TABLE public.production_lots 
ADD COLUMN product_id UUID REFERENCES public.products(id),
ADD COLUMN weight_per_unit NUMERIC DEFAULT 0;

-- Comment for clarity
COMMENT ON COLUMN public.production_lots.product_id IS 'Liên kết sản phẩm cụ thể cho từng Lot trong một lệnh sản xuất';
COMMENT ON COLUMN public.production_lots.weight_per_unit IS 'Khối lượng trên một đơn vị của sản phẩm trong Lot này';

-- Optional: If we want to move existing data from productions to production_lots
-- This is just a helper if there's already data
UPDATE public.production_lots pl
SET product_id = p.product_id,
    weight_per_unit = p.weight_per_unit
FROM public.productions p
WHERE pl.production_id = p.id
AND p.product_id IS NOT NULL;
