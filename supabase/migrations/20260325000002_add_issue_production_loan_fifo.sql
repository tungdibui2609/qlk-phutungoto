-- migration: 20260325000002_add_issue_production_loan_fifo.sql
-- Function to issue production loans using FIFO strategy

CREATE OR REPLACE FUNCTION public.issue_production_loan_fifo(
    p_product_id UUID,
    p_worker_name TEXT,
    p_total_quantity NUMERIC,
    p_unit TEXT,
    p_system_code TEXT,
    p_production_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_remaining_qty NUMERIC := p_total_quantity;
    v_lot_item RECORD;
    v_deduct_qty NUMERIC;
    v_new_lot_item_qty NUMERIC;
    v_lot_total_qty NUMERIC;
BEGIN
    -- 1. Check total availability first to avoid partial failures
    SELECT SUM(li.quantity) INTO v_lot_total_qty
    FROM public.lot_items li
    JOIN public.lots l ON li.lot_id = l.id
    WHERE li.product_id = p_product_id 
      AND l.system_code = p_system_code
      AND li.quantity > 0;

    IF v_lot_total_qty IS NULL OR v_lot_total_qty < p_total_quantity THEN
        RAISE EXCEPTION 'Không đủ tồn kho để cấp phát. Yêu cầu: %, Hiện có: %', p_total_quantity, COALESCE(v_lot_total_qty, 0);
    END IF;

    -- 2. Iterate through lot_items in FIFO order
    FOR v_lot_item IN 
        SELECT li.id as lot_item_id, li.quantity as item_qty, l.id as lot_id, l.code as lot_code
        FROM public.lot_items li
        JOIN public.lots l ON li.lot_id = l.id
        WHERE li.product_id = p_product_id 
          AND l.system_code = p_system_code
          AND li.quantity > 0
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
        -- We recalculate total lot quantity to be safe
        SELECT SUM(quantity) INTO v_lot_total_qty
        FROM public.lot_items
        WHERE lot_id = v_lot_item.lot_id;

        UPDATE public.lots
        SET 
            quantity = COALESCE(v_lot_total_qty, 0),
            status = CASE 
                WHEN COALESCE(v_lot_total_qty, 0) <= 0.000001 THEN 'Đã xuất hết cho công trình'
                ELSE status -- Keep current status if still has items, or 'active' if it was empty (though it shouldn't be if we are here)
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.issue_production_loan_fifo TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_production_loan_fifo TO service_role;
