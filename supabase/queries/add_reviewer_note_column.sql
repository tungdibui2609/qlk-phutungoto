-- Thêm cột reviewer_note vào bảng inventory_check_items để hỗ trợ phản hồi từ người duyệt
ALTER TABLE public.inventory_check_items 
ADD COLUMN IF NOT EXISTS reviewer_note text;

-- Thêm comment cho cột để rõ ràng mục đích
COMMENT ON COLUMN public.inventory_check_items.reviewer_note IS 'Ghi chú phản hồi của người duyệt (quản lý)';
