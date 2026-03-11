-- Add is_modified column to internal_inventory_items to track physical edits during inventory
ALTER TABLE public.internal_inventory_items 
ADD COLUMN IF NOT EXISTS is_modified boolean DEFAULT false;

-- Update RLS policies (though they are already 'true' for all, keeping it consistent)
COMMENT ON COLUMN public.internal_inventory_items.is_modified IS 'Trạng thái đã được chỉnh sửa thông tin LOT trực tiếp trong quá trình kiểm kê';
