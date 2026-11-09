-- Add description column to work_plan_items to store task details / template instructions
ALTER TABLE IF EXISTS public.work_plan_items 
ADD COLUMN IF NOT EXISTS description text;

-- Backfill existing items matching work_task_templates
UPDATE public.work_plan_items wpi
SET description = wtt.description
FROM public.work_task_templates wtt
WHERE (wpi.description IS NULL OR wpi.description = '')
  AND LOWER(TRIM(wpi.content)) = LOWER(TRIM(wtt.title))
  AND (wtt.description IS NOT NULL AND wtt.description <> '');

NOTIFY pgrst, 'reload schema';

