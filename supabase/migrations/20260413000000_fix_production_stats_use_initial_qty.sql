-- FIX V4: Sửa view tính sản lượng gốc từ NHIỀU NGUỒN
-- 
-- CÁCH TIẾP CẬN: Không tạo thêm row, chỉ sửa VIEW để đọc từ 2 nguồn:
--   1. lot_items (cho lot còn hàng) → dùng initial_quantity
--   2. export_task_items (cho lot đã xuất hết, lot_items bị xóa)
-- View cộng cả 2 nguồn lại = sản lượng gốc đầy đủ

-- ====================================================================
-- PHẦN A: ĐẢM BẢO CỘT INITIAL_QUANTITY
-- ====================================================================

ALTER TABLE public.lot_items 
ADD COLUMN IF NOT EXISTS initial_quantity numeric DEFAULT 0;

-- Cập nhật initial_quantity cho lot_items hiện có (chưa có giá trị)
UPDATE public.lot_items 
SET initial_quantity = quantity 
WHERE (initial_quantity IS NULL OR initial_quantity = 0) AND quantity > 0;

-- ====================================================================
-- PHẦN B: CẬP NHẬT VIEW - KẾT HỢP 2 NGUỒN DỮ LIỆU
-- ====================================================================

DROP VIEW IF EXISTS public.production_item_statistics;

CREATE OR REPLACE VIEW public.production_item_statistics AS
WITH 
-- Nguồn 1: lot_items còn tồn tại (lot chưa xuất hết hoặc còn hàng)
active_lot_stats AS (
    SELECT 
        l.production_id,
        li.product_id,
        li.unit,
        SUM(COALESCE(NULLIF(li.initial_quantity, 0), li.quantity)) as total_qty,
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
    GROUP BY l.production_id, li.product_id, li.unit, p.weight_kg
),
-- Nguồn 2: export_task_items cho lot đã xuất hết (lot_items bị xóa)
-- CHỐNG TRÙNG: Mỗi lot chỉ đếm 1 lần dù nằm trong nhiều lệnh xuất
exported_lot_stats AS (
    SELECT 
        l.production_id,
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
        -- Mỗi LOT chỉ lấy 1 record (quantity lớn nhất = số gốc)
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
      AND NOT EXISTS (
        SELECT 1 FROM public.lot_items li WHERE li.lot_id = l.id
      )
    GROUP BY l.production_id, per_lot.product_id, per_lot.unit, p.weight_kg
),
-- Gộp cả 2 nguồn
combined_stats AS (
    SELECT * FROM active_lot_stats
    UNION ALL
    SELECT * FROM exported_lot_stats
)
SELECT 
    pl.id AS production_lot_id,
    p.id AS product_id,
    p.name AS product_name,
    p.sku AS product_sku,
    p.unit AS product_unit,
    -- actual_quantity = Tổng sản lượng GỐC (lot_items + export_task_items)
    (
        SELECT COALESCE(SUM(cs.total_qty * cs.item_weight_factor), 0)
        FROM combined_stats cs
        WHERE cs.production_id = pl.production_id
          AND cs.product_id = p.id
    ) AS actual_quantity,
    -- current_inventory = Tồn kho hiện tại
    (
        SELECT COALESCE(SUM(cs.current_qty * cs.item_weight_factor), 0)
        FROM combined_stats cs
        WHERE cs.production_id = pl.production_id
          AND cs.product_id = p.id
    ) AS current_inventory,
    (
        SELECT JSON_AGG(
            JSON_BUILD_OBJECT(
                'qty', cs.total_qty, 
                'unit', CASE 
                    WHEN cs.unit NOT LIKE '%(%)%' AND cs.item_weight_factor > 1 AND cs.item_weight_factor != 1.0 THEN cs.unit || ' (' || ROUND(cs.item_weight_factor, 2) || 'kg)'
                    ELSE cs.unit
                END
            )
        )
        FROM combined_stats cs
        WHERE cs.production_id = pl.production_id
          AND cs.product_id = p.id
    ) AS quantity_by_unit
FROM public.production_lots pl
JOIN public.products p ON p.id = pl.product_id;

COMMENT ON VIEW public.production_item_statistics IS 'Sản lượng gốc = lot_items (còn hàng) + export_task_items (đã xuất hết). Không bị ảnh hưởng bởi xuất kho.';

-- ====================================================================
-- PHẦN C: TRIGGER TỰ ĐỘNG GHI INITIAL_QUANTITY
-- ====================================================================

CREATE OR REPLACE FUNCTION public.fn_set_initial_quantity()
RETURNS trigger AS $$
BEGIN
    IF NEW.initial_quantity IS NULL OR NEW.initial_quantity = 0 THEN
        NEW.initial_quantity := NEW.quantity;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_initial_quantity ON public.lot_items;

CREATE TRIGGER trg_set_initial_quantity
    BEFORE INSERT ON public.lot_items
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_set_initial_quantity();
