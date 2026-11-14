-- Thêm mã sản phẩm (item_sku) vào operation_images để đặt tên file ngắn gọn trên Drive và tìm kiếm theo mã/tên
ALTER TABLE public.operation_images
  ADD COLUMN IF NOT EXISTS item_sku text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_operation_images_sku
  ON public.operation_images (system_code, item_sku)
  WHERE item_sku IS NOT NULL;
