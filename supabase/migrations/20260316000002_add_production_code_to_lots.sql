-- Add production_code column to lots table
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS production_code TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.lots.production_code IS 'Mã sản xuất của lô hàng (tuân theo cấu trúc đa cấp)';
