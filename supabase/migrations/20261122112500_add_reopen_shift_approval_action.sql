-- Mở rộng loại thao tác duyệt trong operation_approval_requests để hỗ trợ 'reopen_shift' (Mở lại công việc đã hoàn thành)
ALTER TABLE public.operation_approval_requests
  DROP CONSTRAINT IF EXISTS operation_approval_requests_action_type_check;

ALTER TABLE public.operation_approval_requests
  ADD CONSTRAINT operation_approval_requests_action_type_check
  CHECK (action_type = ANY (ARRAY[
    'delete_shift'::text,
    'delete_image'::text,
    'delete_journal'::text,
    'update_journal'::text,
    'reopen_shift'::text
  ]));
