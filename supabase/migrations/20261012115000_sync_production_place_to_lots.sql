-- Migration: Tự động đồng bộ Nơi sản xuất / Nhà máy từ dấu đóng và tem thùng vào Lô (lots)
-- Khi tem đóng dấu (hoặc tem thùng) được liên kết vào Lô từ app mobile hoặc web,
-- trigger sẽ tự động trích xuất mã nhà máy (hoặc tên cơ sở) và đối soát với bảng production_places
-- để cập nhật vào metadata.production_places & metadata.production_place của Lô.

CREATE OR REPLACE FUNCTION public.sync_lot_dates_from_boxes(target_lot_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    cur_lot record;
    cur_meta jsonb;

    -- Ngày tháng
    manual_dates text[] := '{}';
    scanned_dates text[] := '{}';
    final_dates text[] := '{}';
    detected_raw_material_date text := NULL;

    -- Vùng nguyên liệu (vùng trồng)
    manual_zones text[] := '{}';
    scanned_zones text[] := '{}';
    final_zones text[] := '{}';

    -- Nơi sản xuất / Nhà máy
    manual_places text[] := '{}';
    scanned_places text[] := '{}';
    final_places text[] := '{}';

    rec record;
    parsed_date text;
    raw_date text;
    clean_l2 text;
    dd text; mm text; yy text;
    is_stamp boolean;

    raw_zone_text text;
    single_zone text;
    prov_code text;
    matched_zone text;

    raw_place_text text;
    single_place text;
    factory_code text;
    matched_place text;
    dict_factory_name text;
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

    -- 1. Lấy ngày nhập tay từ form (nếu có lưu manual_peeling_dates)
    IF cur_meta ? 'manual_peeling_dates' AND jsonb_typeof(cur_meta->'manual_peeling_dates') = 'array' THEN
        SELECT COALESCE(array_agg(public.parse_date_to_iso(x.val)), '{}'::text[])
        INTO manual_dates
        FROM jsonb_array_elements_text(cur_meta->'manual_peeling_dates') AS x(val)
        WHERE public.parse_date_to_iso(x.val) IS NOT NULL;
    END IF;

    -- 2. Lấy vùng nguyên liệu nhập tay từ form (nếu có lưu manual_material_zones hoặc material_zones)
    IF cur_meta ? 'manual_material_zones' AND jsonb_typeof(cur_meta->'manual_material_zones') = 'array' THEN
        SELECT COALESCE(array_agg(trim(x.val)), '{}'::text[])
        INTO manual_zones
        FROM jsonb_array_elements_text(cur_meta->'manual_material_zones') AS x(val)
        WHERE trim(x.val) <> '';
    ELSIF cur_meta ? 'material_zones' AND jsonb_typeof(cur_meta->'material_zones') = 'array' THEN
        SELECT COALESCE(array_agg(trim(x.val)), '{}'::text[])
        INTO manual_zones
        FROM jsonb_array_elements_text(cur_meta->'material_zones') AS x(val)
        WHERE trim(x.val) <> '';
    ELSIF cur_meta ? 'material_zone' AND trim(cur_meta->>'material_zone') <> '' THEN
        SELECT COALESCE(array_agg(trim(s)), '{}'::text[])
        INTO manual_zones
        FROM unnest(string_to_array(cur_meta->>'material_zone', ',')) AS s
        WHERE trim(s) <> '';
    END IF;

    -- 3. Lấy nơi sản xuất nhập tay từ form (nếu có lưu manual_production_places hoặc production_places / production_place)
    IF cur_meta ? 'manual_production_places' AND jsonb_typeof(cur_meta->'manual_production_places') = 'array' THEN
        SELECT COALESCE(array_agg(trim(x.val)), '{}'::text[])
        INTO manual_places
        FROM jsonb_array_elements_text(cur_meta->'manual_production_places') AS x(val)
        WHERE trim(x.val) <> '';
    ELSIF cur_meta ? 'production_places' AND jsonb_typeof(cur_meta->'production_places') = 'array' THEN
        SELECT COALESCE(array_agg(trim(x.val)), '{}'::text[])
        INTO manual_places
        FROM jsonb_array_elements_text(cur_meta->'production_places') AS x(val)
        WHERE trim(x.val) <> '';
    ELSIF cur_meta ? 'production_place' AND trim(cur_meta->>'production_place') <> '' THEN
        SELECT COALESCE(array_agg(trim(s)), '{}'::text[])
        INTO manual_places
        FROM unnest(string_to_array(cur_meta->>'production_place', ',')) AS s
        WHERE trim(s) <> '';
    END IF;

    -- 4. Quét toàn bộ các con tem đang liên kết với Lô này
    FOR rec IN 
        SELECT code, metadata 
        FROM public.box_labels 
        WHERE lot_id = target_lot_id
    LOOP
        -- Kiểm tra chính xác xem có phải tem đóng dấu mực không
        is_stamp := (
            COALESCE(rec.metadata->>'scan_type', '') = 'stamp' 
            OR rec.code LIKE 'STAMP-%'
            OR (rec.metadata->>'stamp_line1' IS NOT NULL AND trim(rec.metadata->>'stamp_line1') <> '')
            OR (rec.metadata->>'stamp_line2' IS NOT NULL AND trim(rec.metadata->>'stamp_line2') <> '')
        );

        clean_l2 := NULL;
        IF rec.metadata->>'stamp_line2' IS NOT NULL THEN
            clean_l2 := regexp_replace(rec.metadata->>'stamp_line2', '[^0-9]', '', 'g');
        END IF;

        -- ============================================================
        -- A. XỬ LÝ NGÀY THÁNG
        -- ============================================================
        IF is_stamp THEN
            -- Tem dấu mực: Bóc tách ngày nhập nguyên liệu từ dòng 2
            raw_date := COALESCE(rec.metadata->>'raw_material_date', rec.metadata->>'inbound_date', rec.metadata->>'production_date');
            IF (raw_date IS NULL OR raw_date = '' OR raw_date = '---') AND (clean_l2 IS NOT NULL) THEN
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
            -- Tem nhãn thành phẩm: Trích xuất Ngày sản xuất (production_date)
            parsed_date := public.parse_date_to_iso(rec.metadata->>'production_date');
            IF parsed_date IS NOT NULL THEN
                scanned_dates := array_append(scanned_dates, parsed_date);
            END IF;
        END IF;

        -- ============================================================
        -- B. XỬ LÝ VÙNG NGUYÊN LIỆU (HỖ TRỢ NHIỀU VÙNG TRỒNG)
        -- ============================================================
        raw_zone_text := COALESCE(
            NULLIF(trim(rec.metadata->>'region'), ''),
            NULLIF(trim(rec.metadata->>'province'), ''),
            NULLIF(trim(rec.metadata->>'material_zone'), '')
        );

        -- Nếu tem dấu chưa có region trong metadata, bóc tách mã tỉnh từ dòng 2 (vị trí 15-16)
        IF (raw_zone_text IS NULL OR raw_zone_text = '' OR raw_zone_text = '---') AND is_stamp AND clean_l2 IS NOT NULL THEN
            IF length(clean_l2) >= 16 THEN
                prov_code := substr(clean_l2, 15, 2);
                SELECT name INTO raw_zone_text
                FROM public.stamp_dictionaries
                WHERE category = 'province' AND code = prov_code AND is_active = true
                LIMIT 1;
            END IF;
        END IF;

        IF raw_zone_text IS NOT NULL AND trim(raw_zone_text) <> '' AND trim(raw_zone_text) <> '---' THEN
            FOREACH single_zone IN ARRAY regexp_split_to_array(raw_zone_text, '[,;/]+') LOOP
                single_zone := trim(single_zone);
                IF single_zone <> '' AND single_zone <> '---' THEN
                    matched_zone := NULL;
                    SELECT (CASE WHEN code IS NOT NULL AND trim(code) <> '' THEN code || ' - ' || name ELSE name END)
                    INTO matched_zone
                    FROM public.material_zones
                    WHERE is_active = true AND (
                        province ILIKE '%' || single_zone || '%' 
                        OR name ILIKE '%' || single_zone || '%' 
                        OR code ILIKE single_zone
                        OR single_zone ILIKE '%' || province || '%'
                        OR single_zone ILIKE '%' || name || '%'
                    )
                    ORDER BY 
                        CASE 
                            WHEN province ILIKE '%' || single_zone || '%' THEN 1
                            WHEN name ILIKE '%' || single_zone || '%' THEN 2
                            ELSE 3
                        END
                    LIMIT 1;

                    IF matched_zone IS NOT NULL THEN
                        scanned_zones := array_append(scanned_zones, matched_zone);
                    ELSE
                        scanned_zones := array_append(scanned_zones, single_zone);
                    END IF;
                END IF;
            END LOOP;
        END IF;

        -- ============================================================
        -- C. XỬ LÝ NƠI SẢN XUẤT / NHÀ MÁY
        -- ============================================================
        raw_place_text := COALESCE(
            NULLIF(trim(rec.metadata->>'production_place'), ''),
            NULLIF(trim(rec.metadata->>'factory'), ''),
            NULLIF(trim(rec.metadata->>'shift_group'), '')
        );

        -- Nếu là tem dấu mực, kiểm tra mã nhà máy từ ký tự 1 của Dòng 2
        IF is_stamp AND clean_l2 IS NOT NULL AND length(clean_l2) >= 1 THEN
            factory_code := substr(clean_l2, 1, 1);
            matched_place := NULL;

            -- 1. Thử đối soát trực tiếp theo mã nhà máy trong production_places (hỗ trợ mã '1', '01'...)
            SELECT name INTO matched_place
            FROM public.production_places
            WHERE is_active = true AND (
                code = factory_code
                OR code = lpad(factory_code, 2, '0')
                OR (code ~ '^[0-9]+$' AND code::int = factory_code::int)
            )
            LIMIT 1;

            -- 2. Nếu chưa thấy, tra từ điển stamp_dictionaries (category = 'factory')
            IF matched_place IS NULL THEN
                SELECT name INTO dict_factory_name
                FROM public.stamp_dictionaries
                WHERE category = 'factory' AND code = factory_code AND is_active = true
                LIMIT 1;

                IF dict_factory_name IS NOT NULL THEN
                    SELECT name INTO matched_place
                    FROM public.production_places
                    WHERE is_active = true AND (
                        name ILIKE '%' || dict_factory_name || '%'
                        OR dict_factory_name ILIKE '%' || name || '%'
                    )
                    LIMIT 1;

                    IF matched_place IS NULL THEN
                        matched_place := dict_factory_name;
                    END IF;
                END IF;
            END IF;

            IF matched_place IS NOT NULL THEN
                scanned_places := array_append(scanned_places, matched_place);
            END IF;
        ELSIF raw_place_text IS NOT NULL AND raw_place_text <> '' AND raw_place_text <> '---' THEN
            -- Tem nhãn có ghi shift_group hoặc production_place
            FOREACH single_place IN ARRAY regexp_split_to_array(raw_place_text, '[,;/]+') LOOP
                single_place := trim(single_place);
                IF single_place <> '' AND single_place <> '---' THEN
                    matched_place := NULL;
                    SELECT name INTO matched_place
                    FROM public.production_places
                    WHERE is_active = true AND (
                        name ILIKE '%' || single_place || '%'
                        OR single_place ILIKE '%' || name || '%'
                        OR code ILIKE single_place
                        OR (code ~ '^[0-9]+$' AND single_place ~ '^[0-9]+$' AND code::int = single_place::int)
                    )
                    LIMIT 1;

                    IF matched_place IS NOT NULL THEN
                        scanned_places := array_append(scanned_places, matched_place);
                    ELSE
                        scanned_places := array_append(scanned_places, single_place);
                    END IF;
                END IF;
            END LOOP;
        END IF;

    END LOOP;

    -- 5. Hợp nhất ngày nhập tay + ngày từ các con tem (loại bỏ trùng lặp và sắp xếp theo ngày)
    SELECT COALESCE(array_agg(d ORDER BY d), '{}'::text[])
    INTO final_dates
    FROM (
        SELECT DISTINCT unnest(COALESCE(manual_dates, '{}'::text[]) || COALESCE(scanned_dates, '{}'::text[])) AS d
    ) sub
    WHERE d IS NOT NULL;

    -- 6. Hợp nhất vùng nguyên liệu nhập tay + vùng từ các con tem (loại bỏ trùng lặp)
    SELECT COALESCE(array_agg(z ORDER BY z), '{}'::text[])
    INTO final_zones
    FROM (
        SELECT DISTINCT unnest(COALESCE(manual_zones, '{}'::text[]) || COALESCE(scanned_zones, '{}'::text[])) AS z
    ) sub
    WHERE z IS NOT NULL AND trim(z) <> '';

    -- 7. Hợp nhất nơi sản xuất / nhà máy nhập tay + từ các con tem (loại bỏ trùng lặp)
    SELECT COALESCE(array_agg(p ORDER BY p), '{}'::text[])
    INTO final_places
    FROM (
        SELECT DISTINCT unnest(COALESCE(manual_places, '{}'::text[]) || COALESCE(scanned_places, '{}'::text[])) AS p
    ) sub
    WHERE p IS NOT NULL AND trim(p) <> '';

    -- Cập nhật metadata.peeling_dates
    cur_meta := jsonb_set(cur_meta, '{peeling_dates}', to_jsonb(final_dates));

    -- Cập nhật metadata.material_zones & metadata.material_zone
    IF array_length(final_zones, 1) > 0 THEN
        cur_meta := jsonb_set(cur_meta, '{material_zones}', to_jsonb(final_zones));
        cur_meta := jsonb_set(cur_meta, '{material_zone}', to_jsonb(array_to_string(final_zones, ', ')));
    END IF;

    -- Cập nhật metadata.production_places & metadata.production_place
    IF array_length(final_places, 1) > 0 THEN
        cur_meta := jsonb_set(cur_meta, '{production_places}', to_jsonb(final_places));
        cur_meta := jsonb_set(cur_meta, '{production_place}', to_jsonb(array_to_string(final_places, ', ')));
    END IF;

    -- Lưu xuống bảng lots
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
