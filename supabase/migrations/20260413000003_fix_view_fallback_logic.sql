-- Nâng cấp View production_item_statistics với cơ chế Fallback (Dự phòng)
-- Đảm bảo không mất dữ liệu cho các lệnh sản xuất cũ
DROP VIEW IF EXISTS public.production_item_statistics;

CREATE OR REPLACE VIEW public.production_item_statistics AS
WITH 
-- Hỗ trợ tìm mã Pallet Slot dự phòng dựa trên sản phẩm nếu bị thiếu trong bảng lots
lot_with_fallback AS (
    SELECT 
        l.*,
        COALESCE(
            l.production_lot_id, 
            (
                SELECT pl.id 
                FROM public.production_lots pl 
                WHERE pl.production_id = l.production_id 
                  AND pl.product_id = l.product_id 
                LIMIT 1
            )
        ) as inferred_production_lot_id
    FROM public.lots l
),
active_lot_stats AS (
    SELECT 
        lwf.production_id,
        lwf.inferred_production_lot_id as production_lot_id,
        li.product_id,
        li.unit,
        SUM(COALESCE(li.initial_quantity, li.quantity)) as total_qty,
        SUM(li.quantity) as current_qty,
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
    JOIN lot_with_fallback lwf ON lwf.id = li.lot_id
    JOIN public.products p ON p.id = li.product_id
    WHERE COALESCE(lwf.status, '') != 'deleted'
      AND lwf.production_id IS NOT NULL
    GROUP BY lwf.production_id, lwf.inferred_production_lot_id, li.product_id, li.unit, p.weight_kg
),
exported_lot_stats AS (
    SELECT 
        lwf.production_id,
        lwf.inferred_production_lot_id as production_lot_id,
        per_lot.product_id,
        per_lot.unit,
        SUM(per_lot.lot_qty) as total_qty,
        0::numeric as current_qty,
        COALESCE(
            (
                SELECT pu.conversion_rate 
                FROM public.product_units pu 
                JOIN public.units u ON u.id = pu.unit_id 
                WHERE pu.product_id = per_lot.product_id 
                  AND (
                      LOWER(TRIM(u.name)) = LOWER(TRIM(per_lot.unit))
                      OR LOWER(TRIM(u.name)) = LOWER(TRIM(regexp_replace(per_lot.unit, '\s*\(.*\)', '')))
                  )
                LIMIT 1
            ),
            NULLIF(p.weight_kg, 0),
            public.extract_weight_from_unit(per_lot.unit),
            1.0
        ) as item_weight_factor
    FROM (
        SELECT DISTINCT ON (eti.lot_id, eti.product_id)
            eti.lot_id,
            eti.product_id,
            eti.quantity as lot_qty,
            eti.unit
        FROM public.export_task_items eti
        ORDER BY eti.lot_id, eti.product_id, eti.quantity DESC
    ) per_lot
    JOIN lot_with_fallback lwf ON lwf.id = per_lot.lot_id
    JOIN public.products p ON p.id = per_lot.product_id
    WHERE lwf.production_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.lot_items li WHERE li.lot_id = lwf.id
      )
    GROUP BY lwf.production_id, lwf.inferred_production_lot_id, per_lot.product_id, per_lot.unit, p.weight_kg
),
combined_stats AS (
    SELECT 
        production_id, production_lot_id, product_id, unit, item_weight_factor,
        SUM(total_qty) as total_qty,
        SUM(current_qty) as current_qty
    FROM (
        SELECT * FROM active_lot_stats
        UNION ALL
        SELECT * FROM exported_lot_stats
    ) t
    GROUP BY production_id, production_lot_id, product_id, unit, item_weight_factor
)
SELECT 
    pl.id AS production_lot_id,
    p.id AS product_id,
    p.name AS product_name,
    p.sku AS product_sku,
    p.unit AS product_unit,
    (
        SELECT COALESCE(SUM(cs.total_qty * cs.item_weight_factor), 0)
        FROM combined_stats cs
        WHERE cs.production_lot_id = pl.id
    ) AS actual_quantity,
    (
        SELECT COALESCE(SUM(cs.current_qty * cs.item_weight_factor), 0)
        FROM combined_stats cs
        WHERE cs.production_lot_id = pl.id
    ) AS current_inventory,
    (
        SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'qty', cs.total_qty, 
                'current_qty', cs.current_qty,
                'unit', CASE 
                    WHEN cs.unit NOT LIKE '%(%)%' AND cs.item_weight_factor > 1 AND cs.item_weight_factor != 1.0 THEN cs.unit || ' (' || ROUND(cs.item_weight_factor, 2) || 'kg)'
                    ELSE cs.unit
                END
            )
            ORDER BY cs.total_qty DESC
        )
        FROM combined_stats cs
        WHERE cs.production_lot_id = pl.id
    ) AS quantity_by_unit
FROM public.production_lots pl
JOIN public.products p ON p.id = pl.product_id;
