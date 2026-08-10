-- Kích hoạt Realtime cho bảng positions
-- Thực hiện lệnh này trong SQL Editor của Supabase

-- 1. Thiết lập replica identity để Supabase có thể gửi dữ liệu cũ/mới đầy đủ
ALTER TABLE public.positions REPLICA IDENTITY FULL;

-- 2. Thêm bảng positions vào danh sách các bảng được gửi qua Realtime
-- Nếu có lỗi "publication 'supabase_realtime' does not exist", hãy tạo nó trước bằng:
-- CREATE PUBLICATION supabase_realtime;

ALTER PUBLICATION supabase_realtime ADD TABLE positions;
