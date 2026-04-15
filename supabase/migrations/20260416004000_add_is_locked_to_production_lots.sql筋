-- Add is_locked column to production_lots table
ALTER TABLE public.production_lots 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.production_lots.is_locked IS 'Trạng thái khóa của mã Lot sản xuất. Khi bị khóa, mã này sẽ không xuất hiện trong danh sách chọn sản phẩm khi nhập kho.';
