-- Add conversion_rules column to production_lots to store multi-level conversion rules
ALTER TABLE public.production_lots 
ADD COLUMN IF NOT EXISTS conversion_rules JSONB DEFAULT '[]'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN public.production_lots.conversion_rules IS 'Quy tắc quy đổi đa cấp (ví dụ: 1 Thùng = 13 Khay, 1 Khay = 0.5 Kg)';
