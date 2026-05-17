-- Thêm cột setting_id vào delivery_journal để liên kết 1:N với delivery_settings
-- Mỗi cấu hình sản phẩm (setting) có thể có NHIỀU đợt giao nhận (journal entries)
ALTER TABLE public.delivery_journal ADD COLUMN IF NOT EXISTS setting_id UUID;

-- Index để tối ưu truy vấn theo setting_id
CREATE INDEX IF NOT EXISTS idx_delivery_journal_setting_id ON public.delivery_journal(setting_id);
