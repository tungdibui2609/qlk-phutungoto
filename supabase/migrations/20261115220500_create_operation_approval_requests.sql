-- Tạo bảng yêu cầu duyệt thao tác xóa / sửa từ Scanner & App Mobile lên Web Số liệu
CREATE TABLE IF NOT EXISTS public.operation_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid DEFAULT public.get_user_company_id(),
  system_code text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('delete_shift', 'delete_image', 'delete_journal', 'update_journal')),
  target_table text NOT NULL CHECK (target_table IN ('delivery_shifts', 'operation_images', 'delivery_journal')),
  target_id text NOT NULL,
  shift_id text,
  shift_name text,
  target_label text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  source_device text NOT NULL DEFAULT 'scanner' CHECK (source_device IN ('scanner', 'mobile_app', 'web')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by uuid DEFAULT auth.uid(),
  requested_by_name text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_notes text
);

CREATE INDEX IF NOT EXISTS idx_op_approval_requests_sys_status
  ON public.operation_approval_requests (system_code, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_op_approval_requests_target
  ON public.operation_approval_requests (target_table, target_id, status);

ALTER TABLE public.operation_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY op_approval_requests_select_auth
  ON public.operation_approval_requests
  FOR SELECT
  TO authenticated
  USING (company_id IS NULL OR company_id = public.get_user_company_id());

CREATE POLICY op_approval_requests_insert_auth
  ON public.operation_approval_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

CREATE POLICY op_approval_requests_update_auth
  ON public.operation_approval_requests
  FOR UPDATE
  TO authenticated
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

CREATE POLICY op_approval_requests_delete_auth
  ON public.operation_approval_requests
  FOR DELETE
  TO authenticated
  USING (company_id IS NULL OR company_id = public.get_user_company_id());
