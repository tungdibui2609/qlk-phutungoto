-- Tạo bảng cài đặt nhân viên được phép sửa/xóa số liệu không cần duyệt theo từng phân hệ kho
-- Tuân thủ chuẩn RLS, Multi-System (system_code), Multi-Tenant (company_id)

CREATE TABLE IF NOT EXISTS public.operation_approval_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid DEFAULT public.get_user_company_id(),
  system_code text NOT NULL,
  user_id uuid NOT NULL,
  user_name text,
  allow_update_journal boolean NOT NULL DEFAULT false,
  allow_delete_journal boolean NOT NULL DEFAULT false,
  allow_delete_image boolean NOT NULL DEFAULT false,
  allow_delete_shift boolean NOT NULL DEFAULT false,
  updated_by uuid DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operation_approval_settings_company_sys_user_key UNIQUE (company_id, system_code, user_id)
);

CREATE INDEX IF NOT EXISTS idx_op_approval_settings_sys_user
  ON public.operation_approval_settings (system_code, user_id);

CREATE INDEX IF NOT EXISTS idx_op_approval_settings_company_sys
  ON public.operation_approval_settings (company_id, system_code);

ALTER TABLE public.operation_approval_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "op_approval_settings_select_auth" ON public.operation_approval_settings;
CREATE POLICY "op_approval_settings_select_auth"
  ON public.operation_approval_settings
  FOR SELECT
  TO authenticated
  USING ((company_id IS NULL) OR (company_id = public.get_user_company_id()));

DROP POLICY IF EXISTS "op_approval_settings_insert_auth" ON public.operation_approval_settings;
CREATE POLICY "op_approval_settings_insert_auth"
  ON public.operation_approval_settings
  FOR INSERT
  TO authenticated
  WITH CHECK ((company_id IS NULL) OR (company_id = public.get_user_company_id()));

DROP POLICY IF EXISTS "op_approval_settings_update_auth" ON public.operation_approval_settings;
CREATE POLICY "op_approval_settings_update_auth"
  ON public.operation_approval_settings
  FOR UPDATE
  TO authenticated
  USING ((company_id IS NULL) OR (company_id = public.get_user_company_id()))
  WITH CHECK ((company_id IS NULL) OR (company_id = public.get_user_company_id()));

DROP POLICY IF EXISTS "op_approval_settings_delete_auth" ON public.operation_approval_settings;
CREATE POLICY "op_approval_settings_delete_auth"
  ON public.operation_approval_settings
  FOR DELETE
  TO authenticated
  USING ((company_id IS NULL) OR (company_id = public.get_user_company_id()));
