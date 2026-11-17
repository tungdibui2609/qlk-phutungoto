-- Thêm cấu hình Google Apps Script Webhook cho con dấu và thông tin Google Drive vào hàng đợi

ALTER TABLE public.company_ai_settings
    ADD COLUMN IF NOT EXISTS drive_webhook_url text;

ALTER TABLE public.stamp_scan_queue
    ADD COLUMN IF NOT EXISTS drive_file_id text,
    ADD COLUMN IF NOT EXISTS drive_view_url text,
    ADD COLUMN IF NOT EXISTS approved_lot_code text;

CREATE INDEX IF NOT EXISTS idx_stamp_scan_queue_drive_file_id
    ON public.stamp_scan_queue (drive_file_id);
