-- SQL GIẢI PHÁP CHẮC CHẮN: Phục hồi sản lượng từ lịch sử Metadata và dữ liệu hiện tại
-- Lệnh này khắc phục lỗi "column quantity does not exist" do bảng production_lots không lưu trữ số lượng

-- 1. Đảm bảo bảng lot_items có cột initial_quantity
ALTER TABLE public.lot_items 
ADD COLUMN IF NOT EXISTS initial_quantity numeric DEFAULT 0;

-- 2. PHỤC HỒI DỮ LIỆU THÔNG QUA METADATA (DÀNH CHO DỮ LIỆU ĐÃ XUẤT KHO)
-- Chúng ta bóc tách lịch sử xuất từ lots.metadata và bảng loans để tìm lại các pallet đã biến mất
UPDATE public.lot_items li
SET initial_quantity = li.quantity + 
    -- 2.1 Lấy từ Metadata exports
    COALESCE((
        SELECT SUM((p.value->>'quantity')::numeric)
        FROM public.lots l,
        jsonb_array_elements(COALESCE(l.metadata->'system_history'->'exports', '[]'::jsonb)) as export_entry,
        jsonb_each(export_entry->'items') as p
        WHERE l.id = li.lot_id 
          AND (
            p.key = (li.product_id)::text 
            OR (p.key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND (p.key)::uuid = li.product_id)
          )
    ), 0) +
    -- 2.2 Lấy từ Production Loans (Cấp phát)
    COALESCE((
        SELECT SUM(pl.quantity)
        FROM public.production_loans pl
        WHERE pl.lot_item_id = li.id AND pl.status = 'active'
    ), 0);

-- Fallback: Nếu không có lịch sử thì lấy số hiện tại
UPDATE public.lot_items SET initial_quantity = quantity WHERE initial_quantity = 0 OR initial_quantity IS NULL;

-- 3. CẬP NHẬT VIEW BÁO CÁO (BAO GỒM CẢ CỘT TỒN KHO ĐỂ ĐỐI CHIẾU)
DROP VIEW IF EXISTS public.production_item_statistics;

CREATE OR REPLACE VIEW public.production_item_statistics AS
WITH lot_item_stats AS (
    SELECT 
        l.production_id,
        li.product_id,
        SUM(li.initial_quantity) as total_produced_qty,
        SUM(li.quantity) as current_inventory_qty
    FROM public.lot_items li
    JOIN public.lots l ON l.id = li.lot_id
    WHERE COALESCE(l.status, '') != 'deleted'
      AND l.production_id IS NOT NULL
    GROUP BY l.production_id, li.product_id
)
SELECT 
    pl.id AS production_lot_id,
    p.id AS product_id,
    p.name AS product_name,
    p.sku AS product_sku,
    p.unit AS product_unit,
    COALESCE(lis.total_produced_qty, 0) AS actual_quantity,
    COALESCE(lis.current_inventory_qty, 0) AS current_inventory,
    (
        SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'qty', li.initial_quantity,
                'current_qty', li.quantity,
                'unit', p.unit
            )
        )
        FROM public.lot_items li
        JOIN public.lots l ON l.id = li.lot_id
        WHERE l.production_id = pl.production_id AND li.product_id = p.id
    ) AS quantity_by_unit
FROM public.production_lots pl
JOIN public.products p ON p.id = pl.product_id
LEFT JOIN lot_item_stats lis ON lis.production_id = pl.production_id AND lis.product_id = p.id;
