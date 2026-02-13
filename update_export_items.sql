-- Add status column to export_task_items
ALTER TABLE public.export_task_items 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';

-- Optional: Add check constraint if we want to restrict values, 
-- but for flexibility we might keep it text or 'Pending'/'Exported'
-- 'Pending' = Chưa hạ
-- 'Exported' = Đã xuất
