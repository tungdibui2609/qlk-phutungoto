-- Cập nhật cơ chế đếm người tham gia Chốt Ca Tạm theo từng Đợt (Sub-Shift)
-- Đảm bảo:
-- 1. Mỗi lần chốt ca tạm hoàn tất (finalized) -> reset danh sách người tham gia của đợt (current_batch_participants) về rỗng.
-- 2. Sang đợt mới (ví dụ Đợt #2): chỉ đếm những người thực sự tham gia / có lượt nhập-xuất trong Đợt #2, không cộng dồn người của Đợt #1 đã nghỉ ca.

CREATE OR REPLACE FUNCTION public.register_shift_participant(
    p_shift_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_user_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_shift public.delivery_shifts%ROWTYPE;
    v_summary JSONB;
    v_participants JSONB;
    v_batch_participants JSONB;
    v_uid TEXT;
    v_uname TEXT;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_exists BOOLEAN := FALSE;
    v_batch_exists BOOLEAN := FALSE;
    v_new_list JSONB := '[]'::jsonb;
    v_new_batch_list JSONB := '[]'::jsonb;
    v_item JSONB;
BEGIN
    SELECT * INTO v_shift
    FROM public.delivery_shifts
    WHERE id = p_shift_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN '[]'::jsonb;
    END IF;

    v_uid := COALESCE(p_user_id::text, auth.uid()::text, '');
    v_uname := NULLIF(TRIM(COALESCE(p_user_name, '')), '');

    IF v_uid = '' AND v_uname IS NULL THEN
        RETURN COALESCE(v_shift.summary_data->'current_batch_participants', '[]'::jsonb);
    END IF;

    v_summary := COALESCE(v_shift.summary_data, '{}'::jsonb);

    -- 1. Cập nhật lịch sử toàn ca (participants)
    v_participants := CASE
        WHEN jsonb_typeof(v_summary->'participants') = 'array' THEN v_summary->'participants'
        ELSE '[]'::jsonb
    END;

    FOR v_item IN SELECT value FROM jsonb_array_elements(v_participants)
    LOOP
        IF (v_uid <> '' AND COALESCE(v_item->>'user_id', '') = v_uid)
           OR (v_uid = '' AND v_uname IS NOT NULL AND LOWER(TRIM(COALESCE(v_item->>'user_name', ''))) = LOWER(v_uname)) THEN
            v_exists := TRUE;
            v_new_list := v_new_list || jsonb_build_array(
                jsonb_build_object(
                    'user_id', COALESCE(NULLIF(v_uid, ''), v_item->>'user_id'),
                    'user_name', COALESCE(v_uname, v_item->>'user_name', 'Nhân viên'),
                    'joined_at', COALESCE(v_item->>'joined_at', v_now::text),
                    'last_active_at', v_now::text
                )
            );
        ELSE
            v_new_list := v_new_list || jsonb_build_array(v_item);
        END IF;
    END LOOP;

    IF NOT v_exists THEN
        v_new_list := v_new_list || jsonb_build_array(
            jsonb_build_object(
                'user_id', NULLIF(v_uid, ''),
                'user_name', COALESCE(v_uname, 'Nhân viên'),
                'joined_at', v_now::text,
                'last_active_at', v_now::text
            )
        );
    END IF;

    -- 2. Cập nhật danh sách người tham gia của ĐỢT HIỆN TẠI (current_batch_participants)
    v_batch_participants := CASE
        WHEN jsonb_typeof(v_summary->'current_batch_participants') = 'array' THEN v_summary->'current_batch_participants'
        ELSE '[]'::jsonb
    END;

    FOR v_item IN SELECT value FROM jsonb_array_elements(v_batch_participants)
    LOOP
        IF (v_uid <> '' AND COALESCE(v_item->>'user_id', '') = v_uid)
           OR (v_uid = '' AND v_uname IS NOT NULL AND LOWER(TRIM(COALESCE(v_item->>'user_name', ''))) = LOWER(v_uname)) THEN
            v_batch_exists := TRUE;
            v_new_batch_list := v_new_batch_list || jsonb_build_array(
                jsonb_build_object(
                    'user_id', COALESCE(NULLIF(v_uid, ''), v_item->>'user_id'),
                    'user_name', COALESCE(v_uname, v_item->>'user_name', 'Nhân viên'),
                    'joined_at', COALESCE(v_item->>'joined_at', v_now::text),
                    'last_active_at', v_now::text
                )
            );
        ELSE
            v_new_batch_list := v_new_batch_list || jsonb_build_array(v_item);
        END IF;
    END LOOP;

    IF NOT v_batch_exists THEN
        v_new_batch_list := v_new_batch_list || jsonb_build_array(
            jsonb_build_object(
                'user_id', NULLIF(v_uid, ''),
                'user_name', COALESCE(v_uname, 'Nhân viên'),
                'joined_at', v_now::text,
                'last_active_at', v_now::text
            )
        );
    END IF;

    v_summary := jsonb_set(v_summary, '{participants}', v_new_list, true);
    v_summary := jsonb_set(v_summary, '{current_batch_participants}', v_new_batch_list, true);

    UPDATE public.delivery_shifts
    SET summary_data = v_summary
    WHERE id = p_shift_id;

    RETURN v_new_batch_list;
END;
$$;

-- Helper mới: chỉ gom người tham gia thuộc ĐỢT HIỆN TẠI (sau mốc p_last_to_time)
CREATE OR REPLACE FUNCTION public._collect_batch_participants(
    p_shift public.delivery_shifts,
    p_base_sys TEXT,
    p_last_to_time TIMESTAMPTZ,
    p_closed_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_result JSONB := '[]'::jsonb;
    v_seen_ids TEXT[] := ARRAY[]::TEXT[];
    v_seen_names TEXT[] := ARRAY[]::TEXT[];
    v_summary JSONB := COALESCE(p_shift.summary_data, '{}'::jsonb);
    v_item JSONB;
    v_rec RECORD;
    v_uid TEXT;
    v_uname TEXT;
    v_norm_name TEXT;
    v_item_active TIMESTAMPTZ;
BEGIN
    -- 1. Tất cả người có lượt nhập/xuất trong delivery_journal CỦA ĐỢT HIỆN TẠI
    FOR v_rec IN
        SELECT DISTINCT
            COALESCE(sent_by::text, '') AS uid,
            NULLIF(TRIM(COALESCE(sent_by_name, '')), '') AS uname
        FROM public.delivery_journal
        WHERE system_code IN (p_shift.system_code, p_base_sys)
          AND notes ILIKE ('%[CV_ID: ' || p_shift.id::text || ']%')
          AND (p_last_to_time IS NULL OR sent_at > p_last_to_time)
          AND NOT (id::text = ANY(p_closed_ids))
    LOOP
        v_uid := v_rec.uid;
        v_uname := v_rec.uname;
        v_norm_name := LOWER(COALESCE(v_uname, ''));
        IF (v_uid <> '' AND NOT (v_uid = ANY(v_seen_ids)))
           OR (v_uid = '' AND v_norm_name <> '' AND NOT (v_norm_name = ANY(v_seen_names))) THEN
            IF v_uid <> '' THEN v_seen_ids := array_append(v_seen_ids, v_uid); END IF;
            IF v_norm_name <> '' THEN v_seen_names := array_append(v_seen_names, v_norm_name); END IF;
            v_result := v_result || jsonb_build_array(
                jsonb_build_object(
                    'user_id', NULLIF(v_uid, ''),
                    'user_name', COALESCE(v_uname, 'Nhân viên'),
                    'source', 'journal'
                )
            );
        END IF;
    END LOOP;

    -- 2. Những người đã đăng ký tham gia TRONG ĐỢT HIỆN TẠI (current_batch_participants có hoạt động sau mốc chốt đợt trước)
    IF jsonb_typeof(v_summary->'current_batch_participants') = 'array' THEN
        FOR v_item IN SELECT value FROM jsonb_array_elements(v_summary->'current_batch_participants')
        LOOP
            v_item_active := NULL;
            BEGIN
                IF COALESCE(v_item->>'last_active_at', v_item->>'joined_at', '') <> '' THEN
                    v_item_active := COALESCE(v_item->>'last_active_at', v_item->>'joined_at')::TIMESTAMPTZ;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_item_active := NULL;
            END;

            IF p_last_to_time IS NULL OR (v_item_active IS NOT NULL AND v_item_active > p_last_to_time) THEN
                v_uid := TRIM(COALESCE(v_item->>'user_id', ''));
                v_uname := NULLIF(TRIM(COALESCE(v_item->>'user_name', '')), '');
                v_norm_name := LOWER(COALESCE(v_uname, ''));
                IF (v_uid <> '' AND NOT (v_uid = ANY(v_seen_ids)))
                   OR (v_uid = '' AND v_norm_name <> '' AND NOT (v_norm_name = ANY(v_seen_names))) THEN
                    IF v_uid <> '' THEN v_seen_ids := array_append(v_seen_ids, v_uid); END IF;
                    IF v_norm_name <> '' THEN v_seen_names := array_append(v_seen_names, v_norm_name); END IF;
                    v_result := v_result || jsonb_build_array(
                        jsonb_build_object(
                            'user_id', NULLIF(v_uid, ''),
                            'user_name', COALESCE(v_uname, 'Nhân viên'),
                            'source', 'batch_participant'
                        )
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 3. Những người đã xác nhận trong pending_interim_close của đợt hiện tại
    IF jsonb_typeof(v_summary->'pending_interim_close'->'confirmations') = 'array' THEN
        FOR v_item IN SELECT value FROM jsonb_array_elements(v_summary->'pending_interim_close'->'confirmations')
        LOOP
            v_uid := TRIM(COALESCE(v_item->>'user_id', ''));
            v_uname := NULLIF(TRIM(COALESCE(v_item->>'user_name', '')), '');
            v_norm_name := LOWER(COALESCE(v_uname, ''));
            IF (v_uid <> '' AND NOT (v_uid = ANY(v_seen_ids)))
               OR (v_uid = '' AND v_norm_name <> '' AND NOT (v_norm_name = ANY(v_seen_names))) THEN
                IF v_uid <> '' THEN v_seen_ids := array_append(v_seen_ids, v_uid); END IF;
                IF v_norm_name <> '' THEN v_seen_names := array_append(v_seen_names, v_norm_name); END IF;
                v_result := v_result || jsonb_build_array(
                    jsonb_build_object(
                        'user_id', NULLIF(v_uid, ''),
                        'user_name', COALESCE(v_uname, 'Nhân viên'),
                        'source', 'confirmation'
                    )
                );
            END IF;
        END LOOP;
    END IF;

    -- 4. Chỉ riêng Đợt #1 (chưa từng chốt tạm) mới lấy thêm người mở ca nếu chưa có trong danh sách
    IF p_last_to_time IS NULL THEN
        v_uid := COALESCE(p_shift.opened_by::text, '');
        v_uname := NULLIF(TRIM(COALESCE(p_shift.opened_by_name, '')), '');
        v_norm_name := LOWER(COALESCE(v_uname, ''));
        IF (v_uid <> '' AND NOT (v_uid = ANY(v_seen_ids)))
           OR (v_uid = '' AND v_norm_name <> '' AND NOT (v_norm_name = ANY(v_seen_names))) THEN
            IF v_uid <> '' THEN v_seen_ids := array_append(v_seen_ids, v_uid); END IF;
            IF v_norm_name <> '' THEN v_seen_names := array_append(v_seen_names, v_norm_name); END IF;
            v_result := v_result || jsonb_build_array(
                jsonb_build_object(
                    'user_id', NULLIF(v_uid, ''),
                    'user_name', COALESCE(v_uname, 'Nhân viên'),
                    'source', 'opened_by'
                )
            );
        END IF;
    END IF;

    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_interim_close_status(
    p_shift_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_shift public.delivery_shifts%ROWTYPE;
    v_base_sys TEXT;
    v_last_sub_num INT := 0;
    v_last_to_time TIMESTAMPTZ := NULL;
    v_from_time TIMESTAMPTZ;
    v_closed_ids TEXT[] := ARRAY[]::TEXT[];
    v_participants JSONB;
    v_pending JSONB;
    v_confirmations JSONB := '[]'::jsonb;
    v_missing JSONB := '[]'::jsonb;
    v_p JSONB;
    v_c JSONB;
    v_is_confirmed BOOLEAN;
    v_batch_count INT := 0;
    v_user_counts JSONB := '{}'::jsonb;
    v_u_rec RECORD;
BEGIN
    SELECT * INTO v_shift
    FROM public.delivery_shifts
    WHERE id = p_shift_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy công việc';
    END IF;

    v_base_sys := regexp_replace(v_shift.system_code, '__solieu$', '');

    SELECT
        COALESCE(MAX(sub_shift_number), 0),
        MAX(to_time)
    INTO v_last_sub_num, v_last_to_time
    FROM public.delivery_sub_shifts
    WHERE shift_id = p_shift_id;

    SELECT COALESCE(array_agg(DISTINCT jid), ARRAY[]::TEXT[])
    INTO v_closed_ids
    FROM (
        SELECT jsonb_array_elements_text(summary_data->'journal_ids') AS jid
        FROM public.delivery_sub_shifts
        WHERE shift_id = p_shift_id
          AND jsonb_typeof(summary_data->'journal_ids') = 'array'
    ) t;

    v_from_time := COALESCE(v_last_to_time, v_shift.opened_at);

    SELECT COUNT(*)
    INTO v_batch_count
    FROM public.delivery_journal j
    WHERE j.system_code IN (v_shift.system_code, v_base_sys)
      AND j.notes ILIKE ('%[CV_ID: ' || p_shift_id::text || ']%')
      AND (v_last_to_time IS NULL OR j.sent_at > v_last_to_time)
      AND NOT (j.id::text = ANY(v_closed_ids));

    FOR v_u_rec IN
        SELECT
            COALESCE(j.sent_by::text, LOWER(TRIM(COALESCE(j.sent_by_name, 'unknown')))) AS ukey,
            COUNT(*) AS cnt
        FROM public.delivery_journal j
        WHERE j.system_code IN (v_shift.system_code, v_base_sys)
          AND j.notes ILIKE ('%[CV_ID: ' || p_shift_id::text || ']%')
          AND (v_last_to_time IS NULL OR j.sent_at > v_last_to_time)
          AND NOT (j.id::text = ANY(v_closed_ids))
        GROUP BY 1
    LOOP
        v_user_counts := jsonb_set(v_user_counts, ARRAY[v_u_rec.ukey], to_jsonb(v_u_rec.cnt), true);
    END LOOP;

    v_participants := public._collect_batch_participants(v_shift, v_base_sys, v_last_to_time, v_closed_ids);
    v_pending := v_shift.summary_data->'pending_interim_close';

    IF v_pending IS NOT NULL
       AND (v_pending->>'sub_shift_number')::INT = (v_last_sub_num + 1)
       AND jsonb_typeof(v_pending->'confirmations') = 'array' THEN
        v_confirmations := v_pending->'confirmations';
    ELSE
        v_pending := NULL;
    END IF;

    FOR v_p IN SELECT value FROM jsonb_array_elements(v_participants)
    LOOP
        v_is_confirmed := FALSE;
        FOR v_c IN SELECT value FROM jsonb_array_elements(v_confirmations)
        LOOP
            IF (COALESCE(v_p->>'user_id', '') <> '' AND v_p->>'user_id' = v_c->>'user_id')
               OR (COALESCE(v_p->>'user_id', '') = '' AND LOWER(TRIM(COALESCE(v_p->>'user_name', ''))) = LOWER(TRIM(COALESCE(v_c->>'user_name', '')))) THEN
                v_is_confirmed := TRUE;
                EXIT;
            END IF;
        END LOOP;
        IF NOT v_is_confirmed THEN
            v_missing := v_missing || jsonb_build_array(v_p);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'shift_id', p_shift_id,
        'next_sub_shift_number', v_last_sub_num + 1,
        'from_time', v_from_time,
        'current_batch_count', v_batch_count,
        'per_user_counts', v_user_counts,
        'participants', v_participants,
        'pending_interim_close', v_pending,
        'confirmed_users', v_confirmations,
        'missing_users', v_missing,
        'total_participants', jsonb_array_length(v_participants),
        'confirmed_count', jsonb_array_length(v_confirmations)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_interim_close(
    p_shift_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_user_name TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_force_finalize BOOLEAN DEFAULT FALSE,
    p_keep_waiting BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_shift public.delivery_shifts%ROWTYPE;
    v_summary JSONB;
    v_base_sys TEXT;
    v_uid TEXT;
    v_uname TEXT;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_last_sub_num INT := 0;
    v_last_to_time TIMESTAMPTZ := NULL;
    v_next_sub_num INT;
    v_from_time TIMESTAMPTZ;
    v_closed_ids TEXT[] := ARRAY[]::TEXT[];
    v_participants JSONB;
    v_pending JSONB;
    v_confirmations JSONB := '[]'::jsonb;
    v_new_confirmations JSONB := '[]'::jsonb;
    v_missing JSONB := '[]'::jsonb;
    v_found_self BOOLEAN := FALSE;
    v_p JSONB;
    v_c JSONB;
    v_is_confirmed BOOLEAN;
    v_j_rec RECORD;
    v_products_summary JSONB := '{}'::jsonb;
    v_units_summary JSONB := '{}'::jsonb;
    v_journal_ids JSONB := '[]'::jsonb;
    v_total_records INT := 0;
    v_pkey TEXT;
    v_ukey TEXT;
    v_cur_p JSONB;
    v_cur_u JSONB;
    v_is_in BOOLEAN;
    v_qty NUMERIC;
    v_all_names TEXT;
    v_all_notes TEXT;
    v_sub_row public.delivery_sub_shifts%ROWTYPE;
    v_updated_summary JSONB;
BEGIN
    SELECT * INTO v_shift
    FROM public.delivery_shifts
    WHERE id = p_shift_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy công việc để chốt ca tạm';
    END IF;

    IF v_shift.status <> 'open' THEN
        RAISE EXCEPTION 'Công việc này đã đóng, không thể chốt ca tạm';
    END IF;

    v_uid := COALESCE(p_user_id::text, auth.uid()::text, '');
    v_uname := COALESCE(NULLIF(TRIM(COALESCE(p_user_name, '')), ''), 'Nhân viên kho');
    v_base_sys := regexp_replace(v_shift.system_code, '__solieu$', '');

    -- Ghi nhận người đang bấm chốt vào đợt hiện tại
    PERFORM public.register_shift_participant(p_shift_id, NULLIF(v_uid, '')::uuid, v_uname);

    SELECT * INTO v_shift
    FROM public.delivery_shifts
    WHERE id = p_shift_id;
    v_summary := COALESCE(v_shift.summary_data, '{}'::jsonb);

    SELECT
        COALESCE(MAX(sub_shift_number), 0),
        MAX(to_time)
    INTO v_last_sub_num, v_last_to_time
    FROM public.delivery_sub_shifts
    WHERE shift_id = p_shift_id;

    v_next_sub_num := v_last_sub_num + 1;
    v_from_time := COALESCE(v_last_to_time, v_shift.opened_at);

    SELECT COALESCE(array_agg(DISTINCT jid), ARRAY[]::TEXT[])
    INTO v_closed_ids
    FROM (
        SELECT jsonb_array_elements_text(summary_data->'journal_ids') AS jid
        FROM public.delivery_sub_shifts
        WHERE shift_id = p_shift_id
          AND jsonb_typeof(summary_data->'journal_ids') = 'array'
    ) t;

    v_pending := v_summary->'pending_interim_close';
    IF v_pending IS NOT NULL
       AND (v_pending->>'sub_shift_number')::INT = v_next_sub_num
       AND jsonb_typeof(v_pending->'confirmations') = 'array' THEN
        v_confirmations := v_pending->'confirmations';
    ELSE
        v_confirmations := '[]'::jsonb;
        v_pending := jsonb_build_object(
            'sub_shift_number', v_next_sub_num,
            'from_time', v_from_time,
            'started_at', v_now,
            'started_by', NULLIF(v_uid, ''),
            'started_by_name', v_uname,
            'confirmations', '[]'::jsonb
        );
    END IF;

    FOR v_c IN SELECT value FROM jsonb_array_elements(v_confirmations)
    LOOP
        IF (v_uid <> '' AND COALESCE(v_c->>'user_id', '') = v_uid)
           OR (v_uid = '' AND LOWER(TRIM(COALESCE(v_c->>'user_name', ''))) = LOWER(v_uname)) THEN
            v_found_self := TRUE;
            v_new_confirmations := v_new_confirmations || jsonb_build_array(
                jsonb_build_object(
                    'user_id', NULLIF(v_uid, ''),
                    'user_name', v_uname,
                    'confirmed_at', v_now,
                    'notes', COALESCE(NULLIF(TRIM(COALESCE(p_notes, '')), ''), v_c->>'notes')
                )
            );
        ELSE
            v_new_confirmations := v_new_confirmations || jsonb_build_array(v_c);
        END IF;
    END LOOP;

    IF NOT v_found_self THEN
        v_new_confirmations := v_new_confirmations || jsonb_build_array(
            jsonb_build_object(
                'user_id', NULLIF(v_uid, ''),
                'user_name', v_uname,
                'confirmed_at', v_now,
                'notes', NULLIF(TRIM(COALESCE(p_notes, '')), '')
            )
        );
    END IF;

    v_pending := jsonb_set(v_pending, '{confirmations}', v_new_confirmations, true);
    v_summary := jsonb_set(v_summary, '{pending_interim_close}', v_pending, true);
    v_shift.summary_data := v_summary;

    -- Gom danh sách người tham gia RIÊNG CỦA ĐỢT HIỆN TẠI
    v_participants := public._collect_batch_participants(v_shift, v_base_sys, v_last_to_time, v_closed_ids);

    FOR v_p IN SELECT value FROM jsonb_array_elements(v_participants)
    LOOP
        v_is_confirmed := FALSE;
        FOR v_c IN SELECT value FROM jsonb_array_elements(v_new_confirmations)
        LOOP
            IF (COALESCE(v_p->>'user_id', '') <> '' AND v_p->>'user_id' = v_c->>'user_id')
               OR (COALESCE(v_p->>'user_id', '') = '' AND LOWER(TRIM(COALESCE(v_p->>'user_name', ''))) = LOWER(TRIM(COALESCE(v_c->>'user_name', '')))) THEN
                v_is_confirmed := TRUE;
                EXIT;
            END IF;
        END LOOP;
        IF NOT v_is_confirmed THEN
            v_missing := v_missing || jsonb_build_array(v_p);
        END IF;
    END LOOP;

    IF (jsonb_array_length(v_missing) > 0 OR p_keep_waiting = TRUE) AND p_force_finalize = FALSE THEN
        UPDATE public.delivery_shifts
        SET summary_data = v_summary
        WHERE id = p_shift_id;

        RETURN jsonb_build_object(
            'status', 'waiting',
            'shift_id', p_shift_id,
            'sub_shift_number', v_next_sub_num,
            'from_time', v_from_time,
            'participants', v_participants,
            'confirmed_users', v_new_confirmations,
            'missing_users', v_missing,
            'total_participants', jsonb_array_length(v_participants),
            'confirmed_count', jsonb_array_length(v_new_confirmations),
            'pending_interim_close', v_pending
        );
    END IF;

    -- ĐỦ TẤT CẢ NGƯỜI CỦA ĐỢT HIỆN TẠI -> CHỐT CHÍNH THỨC & RESET DANH SÁCH NGƯỜI CHO ĐỢT TIẾP THEO
    FOR v_j_rec IN
        SELECT id, item_name, unit, quantity_sent, result_quantity, to_department, status, notes
        FROM public.delivery_journal
        WHERE system_code IN (v_shift.system_code, v_base_sys)
          AND notes ILIKE ('%[CV_ID: ' || p_shift_id::text || ']%')
          AND (v_last_to_time IS NULL OR sent_at > v_last_to_time)
          AND NOT (id::text = ANY(v_closed_ids))
        ORDER BY sent_at ASC
    LOOP
        v_total_records := v_total_records + 1;
        v_journal_ids := v_journal_ids || jsonb_build_array(v_j_rec.id::text);

        v_qty := COALESCE(v_j_rec.quantity_sent, v_j_rec.result_quantity, 0);
        v_is_in := (
            LOWER(COALESCE(v_j_rec.to_department, '')) = 'kho'
            OR LOWER(COALESCE(v_j_rec.status, '')) = 'received_by_warehouse'
            OR COALESCE(v_j_rec.notes, '') ILIKE '%Nhập kho%'
        );

        v_ukey := COALESCE(NULLIF(TRIM(COALESCE(v_j_rec.unit, '')), ''), 'Thùng');
        v_pkey := COALESCE(NULLIF(TRIM(COALESCE(v_j_rec.item_name, '')), ''), 'Sản phẩm') || '___' || v_ukey;

        v_cur_p := COALESCE(
            v_products_summary->v_pkey,
            jsonb_build_object(
                'product_name', COALESCE(NULLIF(TRIM(COALESCE(v_j_rec.item_name, '')), ''), 'Sản phẩm'),
                'unit', v_ukey,
                'in_qty', 0,
                'out_qty', 0,
                'count', 0
            )
        );
        v_cur_p := jsonb_build_object(
            'product_name', v_cur_p->>'product_name',
            'unit', v_ukey,
            'in_qty', ROUND(((v_cur_p->>'in_qty')::NUMERIC + CASE WHEN v_is_in THEN v_qty ELSE 0 END), 2),
            'out_qty', ROUND(((v_cur_p->>'out_qty')::NUMERIC + CASE WHEN NOT v_is_in THEN v_qty ELSE 0 END), 2),
            'count', (v_cur_p->>'count')::INT + 1
        );
        v_products_summary := jsonb_set(v_products_summary, ARRAY[v_pkey], v_cur_p, true);

        v_cur_u := COALESCE(
            v_units_summary->v_ukey,
            jsonb_build_object('in_qty', 0, 'out_qty', 0, 'received', 0, 'sent', 0, 'count', 0)
        );
        v_cur_u := jsonb_build_object(
            'in_qty', ROUND(((v_cur_u->>'in_qty')::NUMERIC + CASE WHEN v_is_in THEN v_qty ELSE 0 END), 2),
            'out_qty', ROUND(((v_cur_u->>'out_qty')::NUMERIC + CASE WHEN NOT v_is_in THEN v_qty ELSE 0 END), 2),
            'received', ROUND(((v_cur_u->>'received')::NUMERIC + CASE WHEN v_is_in THEN v_qty ELSE 0 END), 2),
            'sent', ROUND(((v_cur_u->>'sent')::NUMERIC + CASE WHEN NOT v_is_in THEN v_qty ELSE 0 END), 2),
            'count', (v_cur_u->>'count')::INT + 1
        );
        v_units_summary := jsonb_set(v_units_summary, ARRAY[v_ukey], v_cur_u, true);
    END LOOP;

    SELECT string_agg(DISTINCT NULLIF(TRIM(c->>'user_name'), ''), ', ')
    INTO v_all_names
    FROM jsonb_array_elements(v_new_confirmations) c;

    SELECT string_agg(DISTINCT NULLIF(TRIM(c->>'notes'), ''), ' | ')
    INTO v_all_notes
    FROM jsonb_array_elements(v_new_confirmations) c
    WHERE NULLIF(TRIM(COALESCE(c->>'notes', '')), '') IS NOT NULL;

    INSERT INTO public.delivery_sub_shifts (
        shift_id,
        system_code,
        company_id,
        sub_shift_number,
        from_time,
        to_time,
        closed_by,
        closed_by_name,
        notes,
        summary_data
    ) VALUES (
        p_shift_id,
        v_shift.system_code,
        v_shift.company_id,
        v_next_sub_num,
        v_from_time,
        v_now,
        NULLIF(v_uid, '')::uuid,
        COALESCE(v_all_names, v_uname),
        COALESCE(v_all_notes, 'Chốt đợt ' || v_next_sub_num::text),
        jsonb_build_object(
            'job_name', COALESCE(v_summary->>'job_name', v_shift.notes, 'Công việc'),
            'total_records', v_total_records,
            'products_summary', v_products_summary,
            'units_summary', v_units_summary,
            'journal_ids', v_journal_ids,
            'confirmed_by', v_new_confirmations,
            'participants', v_participants,
            'forced_finalize', p_force_finalize
        )
    )
    RETURNING * INTO v_sub_row;

    -- Xóa pending_interim_close và RESET current_batch_participants về rỗng cho đợt tiếp theo!
    v_updated_summary := jsonb_set(
        (v_summary - 'pending_interim_close'),
        '{current_batch_participants}',
        '[]'::jsonb,
        true
    );
    UPDATE public.delivery_shifts
    SET summary_data = v_updated_summary
    WHERE id = p_shift_id;

    RETURN jsonb_build_object(
        'status', 'finalized',
        'shift_id', p_shift_id,
        'sub_shift_number', v_next_sub_num,
        'sub_shift', to_jsonb(v_sub_row),
        'participants', v_participants,
        'confirmed_users', v_new_confirmations,
        'missing_users', '[]'::jsonb,
        'total_participants', jsonb_array_length(v_participants),
        'confirmed_count', jsonb_array_length(v_new_confirmations)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public._collect_batch_participants(public.delivery_shifts, TEXT, TIMESTAMPTZ, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_shift_participant(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_interim_close_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_interim_close(UUID, UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
