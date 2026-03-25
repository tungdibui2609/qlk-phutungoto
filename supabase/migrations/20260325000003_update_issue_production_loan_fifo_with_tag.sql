-- migration: 20260325000003_update_issue_production_loan_fifo_with_tag.sql
-- Update Function to support Tag-aware FIFO strategy

CREATE OR REPLACE FUNCTION public.issue_production_loan_fifo(
    p_product_id UUID,
    p_worker_name TEXT,
    p_total_quantity NUMERIC,
    p_unit TEXT,
    p_system_code TEXT,
    p_production_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_tag TEXT DEFAULT NULL -- NEW PARAMETER
) RETURNS VOID AS $$
DECLARE
    v_remaining_qty NUMERIC := p_total_quantity;
    v_lot_item RECORD;
    v_deduct_qty NUMERIC;
    v_new_lot_item_qty NUMERIC;
    v_lot_total_qty NUMERIC;
BEGIN
    -- 1. Check total availability for this Product + Tag combination
    SELECT SUM(li.quantity) INTO v_lot_total_qty
    FROM public.lot_items li
    JOIN public.lots l ON li.lot_id = l.id
    LEFT JOIN public.lot_tags lt ON lt.lot_item_id = li.id
    WHERE li.product_id = p_product_id 
      AND l.system_code = p_system_code
      AND li.quantity > 0
      AND (
        (p_tag IS NULL AND lt.tag IS NULL) OR 
        (p_tag IS NOT NULL AND lt.tag = p_tag)
      );

    IF v_lot_total_qty IS NULL OR v_lot_total_qty < p_total_quantity THEN
        RAISE EXCEPTION 'Không đủ tồn kho % (%) để cấp phát. Yêu cầu: %, Hiện có: %', 
            COALESCE(p_tag, 'không tag'), p_unit, p_total_quantity, COALESCE(v_lot_total_qty, 0);
    END IF;

    -- 2. Iterate through matching lot_items in FIFO order
    FOR v_lot_item IN 
        SELECT li.id as lot_item_id, li.quantity as item_qty, l.id as lot_id
        FROM public.lot_items li
        JOIN public.lots l ON li.lot_id = l.id
        LEFT JOIN public.lot_tags lt ON lt.lot_item_id = li.id
        WHERE li.product_id = p_product_id 
          AND l.system_code = p_system_code
          AND li.quantity > 0
          AND (
            (p_tag IS NULL AND lt.tag IS NULL) OR 
            (p_tag IS NOT NULL AND lt.tag = p_tag)
          )
        ORDER BY l.created_at ASC, l.id ASC
    LOOP
        IF v_remaining_qty <= 0 THEN
            EXIT;
        END IF;

        v_deduct_qty := LEAST(v_lot_item.item_qty, v_remaining_qty);
        v_new_lot_item_qty := v_lot_item.item_qty - v_deduct_qty;

        -- A. Update lot_item quantity
        UPDATE public.lot_items 
        SET quantity = v_new_lot_item_qty
        WHERE id = v_lot_item.lot_item_id;

        -- B. Create production_loan record
        INSERT INTO public.production_loans (
            lot_item_id,
            product_id,
            worker_name,
            quantity,
            unit,
            status,
            system_code,
            production_id,
            notes
        ) VALUES (
            v_lot_item.lot_item_id,
            p_product_id,
            p_worker_name,
            v_deduct_qty,
            p_unit,
            'active',
            p_system_code,
            p_production_id,
            p_notes
        );

        -- C. Update LOT total quantity and status
        SELECT SUM(quantity) INTO v_lot_total_qty
        FROM public.lot_items
        WHERE lot_id = v_lot_item.lot_id;

        UPDATE public.lots
        SET 
            quantity = COALESCE(v_lot_total_qty, 0),
            status = CASE 
                WHEN COALESCE(v_lot_total_qty, 0) <= 0.000001 THEN 'Đã xuất hết cho công trình'
                ELSE status 
            END
        WHERE id = v_lot_item.lot_id;

        v_remaining_qty := v_remaining_qty - v_deduct_qty;
    END LOOP;

    -- Final safety check
    IF v_remaining_qty > 0.000001 THEN
        RAISE EXCEPTION 'Lỗi logic FIFO: Còn dư % chưa được trừ', v_remaining_qty;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
