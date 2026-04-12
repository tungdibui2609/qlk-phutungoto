-- SQL KHÔI PHỤC KHẨN CẤP (ROLLBACK) - Đưa dữ liệu về trạng thái ban đầu
-- Chạy lệnh này để hủy bỏ các thay đổi gây lỗi

-- 1. Đưa số liệu trong bảng về trạng thái hiện tại (không cộng dồn lịch sử lỗi nữa)
UPDATE public.lot_items SET initial_quantity = quantity;

-- 2. KHÔI PHỤC VIEW BÁO CÁO CŨ (Về đúng cấu trúc ban đầu)
DROP VIEW IF EXISTS public.production_item_statistics;

CREATE OR REPLACE VIEW public.production_item_statistics AS
WITH lot_item_stats AS (
    SELECT 
        l.production_id,
        li.product_id,
        li.unit,
        SUM(li.quantity) as total_qty,
        COALESCE(
            (
                SELECT pu.conversion_rate 
                FROM public.product_units pu 
                JOIN public.units u ON u.id = pu.unit_id 
                WHERE pu.product_id = li.product_id 
                  AND (
                      LOWER(TRIM(u.name)) = LOWER(TRIM(li.unit))
                      OR LOWER(TRIM(u.name)) = LOWER(TRIM(regexp_replace(li.unit, '\s*\(.*\)', '')))
                  )
                LIMIT 1
            ),
            NULLIF(p.weight_kg, 0),
            public.extract_weight_from_unit(li.unit),
            1.0
        ) as item_weight_factor
    FROM public.lot_items li
    JOIN public.lots l ON l.id = li.lot_id
    JOIN public.products p ON p.id = li.product_id
    WHERE COALESCE(l.status, '') != 'deleted'
      AND l.production_id IS NOT NULL
    GROUP BY l.production_id, li.product_id, li.unit, p.weight_kg
)
SELECT 
    pl.id AS production_lot_id,
    p.id AS product_id,
    p.name AS product_name,
    p.sku AS product_sku,
    p.unit AS product_unit,
    (
        SELECT COALESCE(SUM(lis.total_qty * lis.item_weight_factor), 0)
        FROM lot_item_stats lis
        WHERE lis.production_id = pl.production_id
          AND lis.product_id = p.id
    ) AS actual_quantity,
    (
        SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'qty', lis.total_qty, 
                'unit', CASE 
                    WHEN lis.unit NOT LIKE '%(%)%' AND lis.item_weight_factor > 1 AND lis.item_weight_factor != 1.0 THEN lis.unit || ' (' || ROUND(lis.item_weight_factor, 2) || 'kg)'
                    ELSE lis.unit
                END
            )
        )
        FROM lot_item_stats lis
        WHERE lis.production_id = pl.production_id
          AND lis.product_id = p.id
    ) AS quantity_by_unit
FROM public.production_lots pl
JOIN public.products p ON p.id = pl.product_id;

COMMENT ON VIEW public.production_item_statistics IS 'View đã được khôi phục về trạng thái ban đầu của hệ thống';
