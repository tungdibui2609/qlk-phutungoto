-- Migration: Tự động ghi audit_logs cho delivery_shifts và delivery_journal (/so-lieu & App pallet-box-scanner)
-- Không cần sửa code trên app mobile hay build lại APK.

-- 1. Trigger cho delivery_shifts (Ca làm việc / Công việc)
CREATE OR REPLACE FUNCTION public.fn_audit_delivery_shifts_trigger()
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
        v_user_id := COALESCE(v_user_id, NEW.opened_by);
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW) || jsonb_build_object('_source', 'db_trigger');

    ELSIF (TG_OP = 'UPDATE') THEN
        IF (
            OLD.status IS NOT DISTINCT FROM NEW.status AND
            OLD.notes IS NOT DISTINCT FROM NEW.notes AND
            OLD.summary_data IS NOT DISTINCT FROM NEW.summary_data AND
            OLD.closed_at IS NOT DISTINCT FROM NEW.closed_at
        ) THEN
            RETURN NEW;
        END IF;

        v_action := 'UPDATE';
        v_record_id := NEW.id::text;
        v_system_code := COALESCE(NEW.system_code, OLD.system_code);
        v_user_id := COALESCE(v_user_id, NEW.closed_by, NEW.opened_by);
        v_old_data := to_jsonb(OLD) || jsonb_build_object('_source', 'db_trigger');
        v_new_data := to_jsonb(NEW) || jsonb_build_object('_source', 'db_trigger');

    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'DELETE';
        v_record_id := OLD.id::text;
        v_system_code := OLD.system_code;
        v_user_id := COALESCE(v_user_id, OLD.opened_by);
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
            'delivery_shifts',
            v_record_id,
            v_action,
            v_old_data,
            v_new_data,
            v_user_id,
            v_system_code
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'fn_audit_delivery_shifts_trigger failed: %', SQLERRM;
    END;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_delivery_shifts_changes ON public.delivery_shifts;
CREATE TRIGGER trg_audit_delivery_shifts_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.delivery_shifts
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_delivery_shifts_trigger();


-- 2. Trigger cho delivery_journal (Sổ nhật ký số liệu xuất/nhập)
CREATE OR REPLACE FUNCTION public.fn_audit_delivery_journal_trigger()
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
        v_user_id := COALESCE(v_user_id, NEW.created_by);
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW) || jsonb_build_object('_source', 'db_trigger');

    ELSIF (TG_OP = 'UPDATE') THEN
        IF (
            OLD.item_name IS NOT DISTINCT FROM NEW.item_name AND
            OLD.quantity_sent IS NOT DISTINCT FROM NEW.quantity_sent AND
            OLD.unit IS NOT DISTINCT FROM NEW.unit AND
            OLD.status IS NOT DISTINCT FROM NEW.status AND
            OLD.result_item_name IS NOT DISTINCT FROM NEW.result_item_name AND
            OLD.result_quantity IS NOT DISTINCT FROM NEW.result_quantity AND
            OLD.result_unit IS NOT DISTINCT FROM NEW.result_unit AND
            OLD.notes IS NOT DISTINCT FROM NEW.notes
        ) THEN
            RETURN NEW;
        END IF;

        v_action := 'UPDATE';
        v_record_id := NEW.id::text;
        v_system_code := COALESCE(NEW.system_code, OLD.system_code);
        v_user_id := COALESCE(v_user_id, NEW.created_by);
        v_old_data := to_jsonb(OLD) || jsonb_build_object('_source', 'db_trigger');
        v_new_data := to_jsonb(NEW) || jsonb_build_object('_source', 'db_trigger');

    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'DELETE';
        v_record_id := OLD.id::text;
        v_system_code := OLD.system_code;
        v_user_id := COALESCE(v_user_id, OLD.created_by);
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
            'delivery_journal',
            v_record_id,
            v_action,
            v_old_data,
            v_new_data,
            v_user_id,
            v_system_code
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'fn_audit_delivery_journal_trigger failed: %', SQLERRM;
    END;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_delivery_journal_changes ON public.delivery_journal;
CREATE TRIGGER trg_audit_delivery_journal_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.delivery_journal
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_delivery_journal_trigger();
