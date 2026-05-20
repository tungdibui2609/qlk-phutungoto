-- Thêm cột production_date vào bảng production_lots
ALTER TABLE public.production_lots 
ADD COLUMN IF NOT EXISTS production_date date NULL;

-- Thêm comment giải thích cho cột
COMMENT ON COLUMN public.production_lots.production_date IS 'Ngày sản xuất của mã Lot (YYYY-MM-DD)';
