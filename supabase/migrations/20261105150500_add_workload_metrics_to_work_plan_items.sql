-- Thêm cột workload_metrics (JSONB) vào bảng work_plan_items để lưu số liệu chứng minh khối lượng công việc,
-- độ nặng/nhẹ (light, medium, heavy, very_heavy) và danh sách liên kết Lệnh xuất kho (/work/export-order).
ALTER TABLE public.work_plan_items
ADD COLUMN IF NOT EXISTS workload_metrics JSONB NOT NULL DEFAULT '{}'::jsonb;
