-- Sửa lỗi View thống kê sản lượng hiển thị 0
-- Bổ sung cột planned_quantity nếu chưa có
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='production_lots' AND column_name='planned_quantity') THEN
        ALTER TABLE public.production_lots ADD COLUMN planned_quantity NUMERIC DEFAULT 0;
    END IF;
END $$;

DROP VIEW IF EXISTS public.production_item_statistics;

CREATE OR REPLACE VIEW public.production_item_statistics AS
SELECT 
    pl.id as production_lot_id,
    pl.production_id,
    pl.product_id,
    pl.planned_quantity,
    COALESCE((
        -- Tổng hợp số lượng từ lot_items liên quan đến lot có production_id này
        SELECT SUM(li.quantity)
        FROM public.lots l
        JOIN public.lot_items li ON li.lot_id = l.id
        WHERE l.production_id = pl.production_id
          AND (li.product_id = pl.product_id OR l.product_id = pl.product_id)
          AND l.status = 'active'
    ), 0) + 
    COALESCE((
        -- Trường hợp lot gán trực tiếp product_id nhưng không dùng lot_items (phòng hờ)
        SELECT SUM(l.quantity)
        FROM public.lots l
        WHERE l.production_id = pl.production_id
          AND l.product_id = pl.product_id
          AND l.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM public.lot_items WHERE lot_id = l.id)
    ), 0) as actual_quantity
FROM public.production_lots pl;

-- Cấp quyền truy cập cho View
GRANT SELECT ON public.production_item_statistics TO authenticated;
GRANT SELECT ON public.production_item_statistics TO anon;
GRANT SELECT ON public.production_item_statistics TO service_role;
