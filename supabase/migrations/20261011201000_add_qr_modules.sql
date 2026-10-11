-- Migration: Thêm cột qr_modules vào systems và đăng ký các modules QR vào app_modules
ALTER TABLE public.systems ADD COLUMN IF NOT EXISTS qr_modules text[] DEFAULT ARRAY[]::text[];

INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES
    ('qr_pallets', 'Quản lý Pallet Quét', 'Quản lý, kiểm đếm và theo dõi danh sách Pallet đã quét tem / mã QR theo thời gian thực.', 'qr', true),
    ('qr_lot_labels', 'Liên kết Tem Thùng', 'Quét và gán liên kết mã tem thùng / mã thùng hàng với lô hàng LOT.', 'qr', true),
    ('qr_lot_labels_mobile', 'Liên kết Tem (Mobile)', 'Giao diện di động thao tác nhanh quét liên kết tem thùng trực tiếp tại xưởng.', 'qr', true),
    ('qr_stamp_lookup', 'Tra cứu tem', 'Công cụ tra cứu thông tin chi tiết nguồn gốc và trạng thái của mã tem thùng, dấu đóng.', 'qr', true),
    ('utility_qr_assign', 'Gán vị trí (Quét QR)', 'Quét mã QR để gán nhanh vị trí kho cho Pallet và sản phẩm.', 'qr', true),
    ('qr_export', 'Xuất kho (Quét QR)', 'Thao tác quét mã QR thùng/pallet để thực hiện thủ tục xuất kho chính xác.', 'qr', true),
    ('qr_export_order', 'Lệnh xuất (Quét QR)', 'Quét mã kiểm tra và xuất kho theo lệnh điều động xuất hàng.', 'qr', true),
    ('qr_print_station', 'Máy in trạm', 'Quản lý máy in trạm tại các chốt kiểm soát quét mã và in tem nhãn.', 'qr', true),
    ('qr_mobile_access', 'Mobile (Quét QR)', 'Trung tâm điều hướng giao diện quét mã QR trên thiết bị di động / máy quét cầm tay.', 'qr', true),
    ('qr_production_lot', 'LOT Sản Xuất', 'Quét kiểm tra và theo dõi tiến độ LOT thành phẩm trong dây chuyền sản xuất.', 'qr', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;
