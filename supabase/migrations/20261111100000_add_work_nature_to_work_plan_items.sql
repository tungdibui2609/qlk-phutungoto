-- Phân loại bản chất công việc: lao động tay chân vs thống kê / ghi chép.
-- Công việc thống kê không ghi sản lượng & giờ làm ở báo cáo xếp hạng (chỉ chấm độ chính xác + hoàn thành trong ngày).
ALTER TABLE IF EXISTS public.work_plan_items
ADD COLUMN IF NOT EXISTS work_nature text NOT NULL DEFAULT 'labor';

ALTER TABLE IF EXISTS public.work_plan_items
DROP CONSTRAINT IF EXISTS work_plan_items_work_nature_check;

ALTER TABLE IF EXISTS public.work_plan_items
ADD CONSTRAINT work_plan_items_work_nature_check
CHECK (work_nature IN ('labor', 'statistics'));

NOTIFY pgrst, 'reload schema';
