-- Thêm cột ngưỡng báo động Mức 1 (Báo động)
ALTER TABLE products ADD COLUMN IF NOT EXISTS critical_stock_level numeric DEFAULT 0;

-- Đảm bảo cột last_notified_at tồn tại để tránh lỗi gửi email liên tục
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_notified_at timestamp with time zone;
