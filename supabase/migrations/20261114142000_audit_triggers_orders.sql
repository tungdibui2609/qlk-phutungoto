-- Migration: Tự động ghi audit_logs cho inbound_orders và outbound_orders (tạo/sửa/xóa từ /so-lieu, /inbound, /outbound)
-- Đảm bảo cột "Nhập/Xuất tạm" trên /operation-history nhận đủ 100% thao tác.

CREATE OR REPLACE FUNCTION public.fn_audit_orders_trigger()
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
        v_system_code := COALESCE(NEW.system_code, NEW.system_type);
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW) || jsonb_build_object('_source', 'db_trigger');

    ELSIF (TG_OP = 'UPDATE') THEN
        IF (
            OLD.status IS NOT DISTINCT FROM NEW.status AND
            OLD.code IS NOT DISTINCT FROM NEW.code AND
            OLD.description IS NOT DISTINCT FROM NEW.description AND
            OLD.warehouse_name IS NOT DISTINCT FROM NEW.warehouse_name AND
            OLD.metadata IS NOT DISTINCT FROM NEW.metadata
        ) THEN
            RETURN NEW;
        END IF;

        v_action := 'UPDATE';
        v_record_id := NEW.id::text;
        v_system_code := COALESCE(NEW.system_code, NEW.system_type, OLD.system_code, OLD.system_type);
        v_old_data := to_jsonb(OLD) || jsonb_build_object('_source', 'db_trigger');
        v_new_data := to_jsonb(NEW) || jsonb_build_object('_source', 'db_trigger');

    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'DELETE';
        v_record_id := OLD.id::text;
        v_system_code := COALESCE(OLD.system_code, OLD.system_type);
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
            TG_TABLE_NAME,
            v_record_id,
            v_action,
            v_old_data,
            v_new_data,
            v_user_id,
            v_system_code
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'fn_audit_orders_trigger failed on %: %', TG_TABLE_NAME, SQLERRM;
    END;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_inbound_orders_changes ON public.inbound_orders;
CREATE TRIGGER trg_audit_inbound_orders_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.inbound_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_orders_trigger();

DROP TRIGGER IF EXISTS trg_audit_outbound_orders_changes ON public.outbound_orders;
CREATE TRIGGER trg_audit_outbound_orders_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.outbound_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_orders_trigger();
