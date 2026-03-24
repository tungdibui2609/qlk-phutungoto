-- Ensure lots table has production_lot_id column to link to specific production items
ALTER TABLE public.lots 
ADD COLUMN IF NOT EXISTS production_lot_id UUID REFERENCES public.production_lots(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lots.production_lot_id IS 'Liên kết trực tiếp với hạng mục trong lệnh sản xuất';

-- Helper function to extract weight from unit name (e.g. "Thùng (10 Kg)" -> 10)
CREATE OR REPLACE FUNCTION public.extract_weight_from_unit(unit_name text) RETURNS numeric AS $$
DECLARE
    weight_match text[];
BEGIN
    -- Look for pattern like "(10 Kg)" or "(Thùng 10 kg)" or "(... 10.5 kg)"
    -- Matches: (10 kg), (10.5 Kg), (Thùng 10kg), (Thùng 10.5 KG)
    weight_match := regexp_matches(unit_name, '\(\s*.*?\s*(\d+(\.\d+)?)\s*[kK]?[gG]\s*\)');
    IF weight_match IS NOT NULL AND array_length(weight_match, 1) >= 1 THEN
        RETURN weight_match[1]::numeric;
    END IF;
    RETURN 1.0; -- Default if no pattern found (e.g. "Kg", "Cái")
EXCEPTION WHEN OTHERS THEN
    RETURN 1.0;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop and recreate the view with granular item-level conversion logic
DROP VIEW IF EXISTS public.production_item_statistics;

CREATE OR REPLACE VIEW public.production_item_statistics AS
WITH lot_item_stats AS (
    SELECT 
        l.production_id,
        li.product_id,
        li.unit,
        SUM(li.quantity) as total_qty,
        -- Calculate weight factor for each item
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
