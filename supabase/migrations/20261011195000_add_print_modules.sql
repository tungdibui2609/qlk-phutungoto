-- Migration: Thêm module in ấn vào systems và app_modules
ALTER TABLE public.systems ADD COLUMN IF NOT EXISTS print_modules text[] DEFAULT ARRAY[]::text[];

-- Upsert 4 print modules vào app_modules
INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES
    ('print_bank_report', 'Phiếu ngân hàng', 'In báo cáo, biểu mẫu kê khai tồn kho và chứng từ cầm cố/bảo lãnh ngân hàng.', 'print', true),
    ('bank_inbound', 'Nhập ngân hàng', 'Quản lý và in ấn chứng từ nhập kho phục vụ thủ tục hồ sơ ngân hàng.', 'print', true),
    ('bank_outbound', 'Xuất ngân hàng', 'Quản lý và in ấn chứng từ giải chấp, xuất kho phục vụ thủ tục hồ sơ ngân hàng.', 'print', true),
    ('print_sequence_number', 'In số thứ tự (STT)', 'In bảng danh sách và biểu mẫu số thứ tự LOT theo ngày / lô sản xuất.', 'print', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;
