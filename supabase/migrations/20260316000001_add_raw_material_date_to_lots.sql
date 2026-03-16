-- Add raw_material_date column to lots table
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS raw_material_date TIMESTAMPTZ;

-- Update existing lots description if needed or just leave as null
COMMENT ON COLUMN public.lots.raw_material_date IS 'Ngày nhập nguyên liệu thô của lô hàng';
