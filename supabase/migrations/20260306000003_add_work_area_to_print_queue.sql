-- Add work_area_id to print_queue table
ALTER TABLE public.print_queue
ADD COLUMN IF NOT EXISTS work_area_id UUID REFERENCES public.work_areas(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_print_queue_work_area_id ON public.print_queue(work_area_id);
