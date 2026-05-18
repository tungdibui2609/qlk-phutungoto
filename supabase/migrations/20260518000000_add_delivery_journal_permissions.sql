-- Migration: Thêm permissions cho module Giao nhận
INSERT INTO public.permissions (code, name, module, description)
VALUES 
    ('delivery_journal.view', 'Xem nhật ký giao nhận', 'Giao nhận', 'Cho phép xem nhật ký giao nhận và ca làm việc'),
    ('delivery_journal.manage', 'Quản lý giao nhận', 'Giao nhận', 'Cho phép cấu hình cài đặt giao nhận và ca làm việc')
ON CONFLICT (code) DO NOTHING;
