-- Migration: Tự động ghi audit_logs cho shift_tasks (/work/tasks - Sổ giao việc)
-- Tự động hiển thị ở cột "Công việc / Khác" trên /operation-history.

CREATE OR REPLACE FUNCTION public.fn_audit_shift_tasks_trigger()
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
            OLD.title IS NOT DISTINCT FROM NEW.title AND
            OLD.content IS NOT DISTINCT FROM NEW.content AND
            OLD.status IS NOT DISTINCT FROM NEW.status AND
            OLD.priority IS NOT DISTINCT FROM NEW.priority AND
            OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to AND
            OLD.acknowledged_at IS NOT DISTINCT FROM NEW.acknowledged_at AND
            OLD.completed_at IS NOT DISTINCT FROM NEW.completed_at AND
            OLD.completion_notes IS NOT DISTINCT FROM NEW.completion_notes
        ) THEN
            RETURN NEW;
        END IF;

        v_action := 'UPDATE';
        v_record_id := NEW.id::text;
        v_system_code := COALESCE(NEW.system_code, OLD.system_code);
        v_user_id := COALESCE(v_user_id, NEW.completed_by, NEW.acknowledged_by, NEW.created_by);
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
            'shift_tasks',
            v_record_id,
            v_action,
            v_old_data,
            v_new_data,
            v_user_id,
            v_system_code
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'fn_audit_shift_tasks_trigger failed: %', SQLERRM;
    END;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_shift_tasks_changes ON public.shift_tasks;
CREATE TRIGGER trg_audit_shift_tasks_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.shift_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_audit_shift_tasks_trigger();
