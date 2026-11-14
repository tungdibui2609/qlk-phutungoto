-- Thêm cấu hình tự động xóa ảnh gốc trên máy nhân viên sau N ngày (chỉ khi đã đồng bộ Drive thành công)
ALTER TABLE public.operation_drive_settings
  ADD COLUMN IF NOT EXISTS auto_delete_local_days integer DEFAULT NULL;

COMMENT ON COLUMN public.operation_drive_settings.auto_delete_local_days IS
  'Số ngày giữ ảnh gốc trên máy nhân viên sau khi đã đồng bộ Google Drive thành công (NULL = không tự động xóa)';
