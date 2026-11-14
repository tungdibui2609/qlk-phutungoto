-- Migration: Tự động ghi nhật ký biến động vào bảng audit_logs cho lots, lot_items, positions
-- Đảm bảo bắt đủ 100% thao tác từ Web, API và App Mobile (qlk-app).
-- Cơ chế an toàn: Dùng SECURITY DEFINER + EXCEPTION WHEN OTHERS để không bao giờ làm lỗi giao dịch kho chính.

-- ============================================================================
-- 1. TRIGGER TRÊN BẢNG LOTS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_audit_lots_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_action text;
    v_record_id text;
    v_system_code text;
    v_old_data jsonb;
    v_new_data jsonb;
BEGIN
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF (TG_OP = 'INSERT') THEN
        v_action := 'CREATE';
        v_record_id := NEW.id::text;
        v_system_code := NEW.system_code;
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW) || jsonb_build_object('_source', 'db_trigger');

    ELSIF (TG_OP = 'UPDATE') THEN
        -- Chỉ ghi khi các cột nghiệp vụ quan trọng thực sự thay đổi
        IF (
            OLD.status IS NOT DISTINCT FROM NEW.status AND
            OLD.quantity IS NOT DISTINCT FROM NEW.quantity AND
            OLD.code IS NOT DISTINCT FROM NEW.code AND
            OLD.product_id IS NOT DISTINCT FROM NEW.product_id AND
            OLD.batch_code IS NOT DISTINCT FROM NEW.batch_code AND
            OLD.production_code IS NOT DISTINCT FROM NEW.production_code AND
            OLD.daily_seq IS NOT DISTINCT FROM NEW.daily_seq AND
            OLD.notes IS NOT DISTINCT FROM NEW.notes AND
            OLD.inbound_date IS NOT DISTINCT FROM NEW.inbound_date AND
            OLD.is_locked IS NOT DISTINCT FROM NEW.is_locked AND
            (OLD.metadata->'system_history') IS NOT DISTINCT FROM (NEW.metadata->'system_history')
        ) THEN
            RETURN NEW;
        END IF;

        v_action := 'UPDATE';
        v_record_id := NEW.id::text;
        v_system_code := COALESCE(NEW.system_code, OLD.system_code);
        v_old_data := to_jsonb(OLD) || jsonb_build_object('_source', 'db_trigger');
        v_new_data := to_jsonb(NEW) || jsonb_build_object('_source', 'db_trigger');

    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'DELETE';
        v_record_id := OLD.id::text;
        v_system_code := OLD.system_code;
        v_old_data := to_jsonb(OLD) || jsonb_build_object('_source', 'db_trigger');
        v_new_data := NULL;
    END IF;

    BEGIN
        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by,
            system_code
        ) VALUES (
            'lots',
            v_record_id,
            v_action,
            v_old_data,
            v_new_data,
            v_user_id,
            v_system_code
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'fn_audit_lots_trigger failed: %', SQLERRM;
    END;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_lots_changes ON public.lots;
CREATE TRIGGER trg_audit_lots_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.lots
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_lots_trigger();


-- ============================================================================
-- 2. TRIGGER TRÊN BẢNG LOT_ITEMS (Bắt +2/-3 thùng, thêm/xóa SP, đổi mã SP/ĐVT)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_audit_lot_items_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_action text;
    v_record_id text;
    v_lot_id uuid;
    v_system_code text;
    v_lot_code text;
    v_daily_seq integer;
    v_old_data jsonb;
    v_new_data jsonb;
    v_extra jsonb;
BEGIN
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF (TG_OP = 'INSERT') THEN
        v_action := 'CREATE';
        v_record_id := NEW.id::text;
        v_lot_id := NEW.lot_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (
            OLD.quantity IS NOT DISTINCT FROM NEW.quantity AND
            OLD.product_id IS NOT DISTINCT FROM NEW.product_id AND
            OLD.unit IS NOT DISTINCT FROM NEW.unit AND
            OLD.lot_id IS NOT DISTINCT FROM NEW.lot_id
        ) THEN
            RETURN NEW;
        END IF;
        v_action := 'UPDATE';
        v_record_id := NEW.id::text;
        v_lot_id := NEW.lot_id;
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'DELETE';
        v_record_id := OLD.id::text;
        v_lot_id := OLD.lot_id;
    END IF;

    -- Tra cứu thông tin LOT cha (system_code, code, daily_seq)
    SELECT l.system_code, l.code, l.daily_seq
    INTO v_system_code, v_lot_code, v_daily_seq
    FROM public.lots l
    WHERE l.id = v_lot_id;

    -- Nếu LOT cha vừa bị xóa (CASCADE), bảng lots trigger đã ghi DELETE cho toàn LOT
    -- Ta vẫn ghi hoặc bỏ qua khi v_system_code IS NULL tùy trường hợp; ở đây chỉ bỏ qua khi LOT cha không còn tồn tại lúc DELETE
    IF (TG_OP = 'DELETE' AND v_lot_code IS NULL) THEN
        RETURN OLD;
    END IF;

    v_extra := jsonb_build_object(
        '_source', 'db_trigger',
        '_lot_code', v_lot_code,
        '_daily_seq', v_daily_seq
    );

    IF (TG_OP = 'INSERT') THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW) || v_extra;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD) || v_extra;
        v_new_data := to_jsonb(NEW) || v_extra;
    ELSIF (TG_OP = 'DELETE') THEN
        v_old_data := to_jsonb(OLD) || v_extra;
        v_new_data := NULL;
    END IF;

    BEGIN
        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by,
            system_code
        ) VALUES (
            'lot_items',
            v_record_id,
            v_action,
            v_old_data,
            v_new_data,
            v_user_id,
            v_system_code
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'fn_audit_lot_items_trigger failed: %', SQLERRM;
    END;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_lot_items_changes ON public.lot_items;
CREATE TRIGGER trg_audit_lot_items_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.lot_items
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_lot_items_trigger();


-- ============================================================================
-- 3. TRIGGER TRÊN BẢNG POSITIONS (Bắt mọi gán/gỡ/đổi LOT tại vị trí)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_audit_positions_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_system_code text;
BEGIN
    IF (OLD.lot_id IS NOT DISTINCT FROM NEW.lot_id) THEN
        RETURN NEW;
    END IF;

    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    v_system_code := COALESCE(NEW.system_type, OLD.system_type);

    BEGIN
        INSERT INTO public.audit_logs (
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by,
            system_code
        ) VALUES (
            'positions',
            NEW.id::text,
            'UPDATE',
            jsonb_build_object(
                'lot_id', OLD.lot_id,
                '_position_code', OLD.code,
                '_source', 'db_trigger'
            ),
            jsonb_build_object(
                'lot_id', NEW.lot_id,
                '_position_code', NEW.code,
                '_source', 'db_trigger'
            ),
            v_user_id,
            v_system_code
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'fn_audit_positions_trigger failed: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_positions_changes ON public.positions;
CREATE TRIGGER trg_audit_positions_changes
    AFTER UPDATE ON public.positions
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_positions_trigger();
