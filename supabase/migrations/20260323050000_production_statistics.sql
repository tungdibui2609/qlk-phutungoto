-- 20260323050000_production_statistics.sql
-- Nâng cấp bảng production_lots để lưu trữ số lượng kế hoạch và tạo view thống kê

-- 1. Thêm cột planned_quantity vào bảng production_lots
ALTER TABLE public.production_lots 
ADD COLUMN IF NOT EXISTS planned_quantity DECIMAL DEFAULT NULL;

COMMENT ON COLUMN public.production_lots.planned_quantity IS 'Số lượng sản xuất dự kiến cho sản phẩm này trong lệnh';

-- 2. Tạo View thống kê sản lượng thực tế
-- View này sẽ join từ production_lots đến lots và lot_items để tính tổng quantity đã nhập kho
CREATE OR REPLACE VIEW public.production_item_statistics AS
SELECT 
    pl.id as production_lot_id,
    pl.production_id,
    pl.product_id,
    pl.planned_quantity,
    COALESCE((
        SELECT SUM(li.quantity)
        FROM public.lots l
        JOIN public.lot_items li ON li.lot_id = l.id
        WHERE l.production_id = pl.production_id
          AND li.product_id = pl.product_id
    ), 0) as actual_quantity
FROM public.production_lots pl;

-- 3. Cấp quyền truy cập View cho các role (nếu cần)
GRANT SELECT ON public.production_item_statistics TO authenticated;
GRANT SELECT ON public.production_item_statistics TO service_role;
