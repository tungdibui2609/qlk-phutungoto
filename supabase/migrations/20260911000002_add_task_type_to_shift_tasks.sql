-- Migration: Bổ sung phân loại công việc vs lời nhắc (task vs reminder) cho shift_tasks
ALTER TABLE public.shift_tasks 
ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'task';

CREATE INDEX IF NOT EXISTS idx_shift_tasks_task_type ON public.shift_tasks(task_type);
