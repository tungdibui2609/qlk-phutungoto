-- Nâng cấp View production_item_statistics để phân rã sản lượng theo đúng mã Pallet (production_lot_id)
DROP VIEW IF EXISTS public.production_item_statistics;

CREATE OR REPLACE VIEW public.production_item_statistics AS
WITH 
-- Nguồn 1: lot_items (vật lý, đang tồn trong kho)
active_lot_stats AS (
    SELECT 
        l.production_id,
        l.production_lot_id, -- Quan trọng: Lấy ID của pallet slot
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
    JOIN public.lots l ON l.id = li.lot_id
    JOIN public.products p ON p.id = li.product_id
    WHERE COALESCE(l.status, '') != 'deleted'
      AND l.production_id IS NOT NULL
      AND l.production_lot_id IS NOT NULL -- Chỉ tính những lô có gắn với slot sản xuất
    GROUP BY l.production_id, l.production_lot_id, li.product_id, li.unit, p.weight_kg
),
-- Nguồn 2: export_task_items (đã xuất hết, không còn trong lot_items)
exported_lot_stats AS (
    SELECT 
        l.production_id,
        l.production_lot_id,
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
    JOIN public.lots l ON l.id = per_lot.lot_id
    JOIN public.products p ON p.id = per_lot.product_id
    WHERE l.production_id IS NOT NULL
      AND l.production_lot_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.lot_items li WHERE li.lot_id = l.id
      )
    GROUP BY l.production_id, l.production_lot_id, per_lot.product_id, per_lot.unit, p.weight_kg
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
