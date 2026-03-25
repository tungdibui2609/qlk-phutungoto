-- migration: 20260325000000_link_loans_to_productions.sql
-- Thêm cột production_id để liên kết Cấp phát với Lệnh sản xuất

-- 1. Thêm cột production_id vào bảng production_loans
ALTER TABLE public.production_loans 
ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES public.productions(id) ON DELETE SET NULL;

-- 2. Thêm ghi chú cho cột
COMMENT ON COLUMN public.production_loans.production_id IS 'ID của lệnh sản xuất mà vật tư này được cấp phát cho';

-- 3. Cập nhật View thống kê nếu cần (hiện tại chưa cần vì View thống kê sản lượng thực tế nằm ở bảng production_item_statistics)
-- Nếu muốn thống kê cấp phát qua View, ta có thể tạo thêm View mới ở đây.
CREATE OR REPLACE VIEW public.production_allocation_statistics AS
SELECT 
    p.id as production_id,
    p.code as production_code,
    p.name as production_name,
    pl.product_id,
    prod.name as product_name,
    prod.sku as product_sku,
    SUM(CASE WHEN pl.status = 'active' THEN pl.quantity ELSE 0 END) as total_issued,
    SUM(CASE WHEN pl.status = 'returned' THEN pl.quantity ELSE 0 END) as total_returned,
    SUM(CASE WHEN pl.status = 'lost' THEN pl.quantity ELSE 0 END) as total_lost,
    pl.unit
FROM public.productions p
JOIN public.production_loans pl ON pl.production_id = p.id
JOIN public.products prod ON prod.id = pl.product_id
GROUP BY p.id, p.code, p.name, pl.product_id, prod.name, prod.sku, pl.unit;

GRANT SELECT ON public.production_allocation_statistics TO authenticated;
GRANT SELECT ON public.production_allocation_statistics TO service_role;
