-- Migration: Tự động đồng bộ ngày sản xuất & ngày nguyên liệu từ box_labels vào bảng lots bằng Database Trigger
-- 1. Hàm helper chuẩn hóa chuỗi ngày (DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, YYYY-MM-DD) sang chuẩn YYYY-MM-DD
CREATE OR REPLACE FUNCTION public.parse_date_to_iso(date_str text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    clean text;
    d text; m text; y text;
    matches text[];
BEGIN
    IF date_str IS NULL OR trim(date_str) = '' OR trim(date_str) = '---' THEN
        RETURN NULL;
    END IF;
    clean := trim(date_str);

    -- 1. DD/MM/YYYY hoặc DD-MM-YYYY
    matches := regexp_matches(clean, '^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})$');
    IF matches IS NOT NULL THEN
        d := lpad(matches[1], 2, '0');
        m := lpad(matches[2], 2, '0');
        y := matches[3];
        RETURN y || '-' || m || '-' || d;
    END IF;

    -- 2. DD/MM/YY hoặc DD-MM-YY (2 chữ số năm)
    matches := regexp_matches(clean, '^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{2})$');
    IF matches IS NOT NULL THEN
        d := lpad(matches[1], 2, '0');
        m := lpad(matches[2], 2, '0');
        y := '20' || matches[3];
        RETURN y || '-' || m || '-' || d;
    END IF;

    -- 3. YYYY-MM-DD
    matches := regexp_matches(clean, '^([0-9]{4})[\/\-]([0-9]{1,2})[\/\-]([0-9]{1,2})');
    IF matches IS NOT NULL THEN
        y := matches[1];
        m := lpad(matches[2], 2, '0');
        d := lpad(matches[3], 2, '0');
        RETURN y || '-' || m || '-' || d;
    END IF;

    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- 2. Hàm tính toán và cập nhật lại ngày cho 1 Lô (được trigger gọi)
CREATE OR REPLACE FUNCTION public.sync_lot_dates_from_boxes(target_lot_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    cur_lot record;
    cur_meta jsonb;
    manual_dates text[] := '{}';
    scanned_dates text[] := '{}';
    final_dates text[] := '{}';
    detected_raw_material_date text := NULL;
    rec record;
    parsed_date text;
    raw_date text;
    clean_l2 text;
    dd text; mm text; yy text;
BEGIN
    IF target_lot_id IS NULL THEN
        RETURN;
    END IF;

    -- Lấy thông tin Lô hiện tại
    SELECT id, peeling_date, raw_material_date, metadata INTO cur_lot
    FROM public.lots WHERE id = target_lot_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    cur_meta := COALESCE(cur_lot.metadata, '{}'::jsonb);

    -- Lấy ngày nhập tay từ form (nếu có lưu manual_peeling_dates)
    IF cur_meta ? 'manual_peeling_dates' AND jsonb_typeof(cur_meta->'manual_peeling_dates') = 'array' THEN
        SELECT COALESCE(array_agg(public.parse_date_to_iso(x.val)), '{}'::text[])
        INTO manual_dates
        FROM jsonb_array_elements_text(cur_meta->'manual_peeling_dates') AS x(val)
        WHERE public.parse_date_to_iso(x.val) IS NOT NULL;
    END IF;

    -- Quét toàn bộ các con tem đang liên kết với Lô này
    FOR rec IN 
        SELECT code, metadata 
        FROM public.box_labels 
        WHERE lot_id = target_lot_id
    LOOP
        -- Kiểm tra tem dấu mực
        IF (rec.metadata->>'scan_type' = 'stamp' OR rec.metadata ? 'stamp_line1' OR rec.metadata ? 'stamp_line2' OR rec.code LIKE 'STAMP-%') THEN
            raw_date := COALESCE(rec.metadata->>'production_date', rec.metadata->>'raw_material_date', rec.metadata->>'inbound_date');
            IF (raw_date IS NULL OR raw_date = '' OR raw_date = '---') AND rec.metadata ? 'stamp_line2' THEN
                clean_l2 := regexp_replace(rec.metadata->>'stamp_line2', '[^0-9]', '', 'g');
                IF length(clean_l2) >= 11 THEN
                    dd := substr(clean_l2, 6, 2);
                    mm := substr(clean_l2, 8, 2);
                    yy := substr(clean_l2, 10, 2);
                    raw_date := dd || '/' || mm || '/20' || yy;
                END IF;
            END IF;

            parsed_date := public.parse_date_to_iso(raw_date);
            IF parsed_date IS NOT NULL AND detected_raw_material_date IS NULL THEN
                detected_raw_material_date := parsed_date;
            END IF;
        ELSE
            -- Tem nhãn: Trích xuất Ngày sản xuất
            parsed_date := public.parse_date_to_iso(rec.metadata->>'production_date');
            IF parsed_date IS NOT NULL THEN
                scanned_dates := array_append(scanned_dates, parsed_date);
            END IF;
        END IF;
    END LOOP;

    -- Hợp nhất ngày nhập tay + ngày từ các con tem (loại bỏ trùng lặp và sắp xếp theo ngày)
    SELECT COALESCE(array_agg(d ORDER BY d), '{}'::text[])
    INTO final_dates
    FROM (
        SELECT DISTINCT unnest(COALESCE(manual_dates, '{}'::text[]) || COALESCE(scanned_dates, '{}'::text[])) AS d
    ) sub
    WHERE d IS NOT NULL;

    -- Cập nhật metadata.peeling_dates của Lô
    cur_meta := jsonb_set(cur_meta, '{peeling_dates}', to_jsonb(final_dates));

    UPDATE public.lots
    SET 
        metadata = cur_meta,
        peeling_date = CASE 
            WHEN array_length(final_dates, 1) > 0 AND (peeling_date IS NULL OR to_char(peeling_date, 'YYYY-MM-DD') NOT IN (SELECT unnest(final_dates))) 
                THEN (final_dates[1] || ' 00:00:00+00')::timestamptz
            WHEN array_length(final_dates, 1) IS NULL 
                THEN NULL
            ELSE peeling_date
        END,
        raw_material_date = CASE
            WHEN detected_raw_material_date IS NOT NULL 
                THEN (detected_raw_material_date || ' 00:00:00+00')::timestamptz
            ELSE raw_material_date
        END
    WHERE id = target_lot_id;
END;
$$;

-- 3. Trigger Function trên bảng box_labels
CREATE OR REPLACE FUNCTION public.trigger_sync_lot_dates_on_box_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Khi INSERT hoặc UPDATE gán lot_id
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.lot_id IS NOT NULL THEN
            PERFORM public.sync_lot_dates_from_boxes(NEW.lot_id);
        END IF;
    END IF;

    -- Khi UPDATE (gỡ Lô / đổi Lô) hoặc DELETE tem
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        IF OLD.lot_id IS NOT NULL AND (TG_OP = 'DELETE' OR OLD.lot_id IS DISTINCT FROM NEW.lot_id) THEN
            PERFORM public.sync_lot_dates_from_boxes(OLD.lot_id);
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

-- 4. Đăng ký Trigger tự động trên bảng box_labels
DROP TRIGGER IF EXISTS trg_sync_box_labels_dates ON public.box_labels;
CREATE TRIGGER trg_sync_box_labels_dates
AFTER INSERT OR UPDATE OF lot_id, metadata OR DELETE
ON public.box_labels
FOR EACH ROW
EXECUTE FUNCTION public.trigger_sync_lot_dates_on_box_change();
