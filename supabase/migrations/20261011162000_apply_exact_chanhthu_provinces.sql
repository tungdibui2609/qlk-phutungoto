-- Áp dụng chuẩn Bảng 5.1.1 Thủ Tục Truy Xuất Nguồn Gốc Sản Phẩm Chánh Thu
-- Chỉ lấy đúng 25 tỉnh thành trong tài liệu quy định của công ty

-- 1. Cập nhật bảng stamp_dictionaries (Dấu đóng - Vùng nguyên liệu)
DELETE FROM stamp_dictionaries WHERE category = 'province';

INSERT INTO stamp_dictionaries (category, code, name, description, is_active, sort_order)
VALUES
('province', '54', 'Phú Yên', 'Tỉnh Phú Yên', true, 1),
('province', '56', 'Khánh Hòa', 'Tỉnh Khánh Hòa', true, 2),
('province', '58', 'Ninh Thuận', 'Tỉnh Ninh Thuận', true, 3),
('province', '60', 'Bình Thuận', 'Tỉnh Bình Thuận', true, 4),
('province', '62', 'Kon Tum', 'Tỉnh Kon Tum', true, 5),
('province', '64', 'Gia Lai', 'Tỉnh Gia Lai', true, 6),
('province', '66', 'Đắk Lắk', 'Tỉnh Đắk Lắk', true, 7),
('province', '67', 'Đắk Nông', 'Tỉnh Đắk Nông', true, 8),
('province', '68', 'Lâm Đồng', 'Tỉnh Lâm Đồng', true, 9),
('province', '70', 'Bình Phước', 'Tỉnh Bình Phước', true, 10),
('province', '72', 'Tây Ninh', 'Tỉnh Tây Ninh', true, 11),
('province', '74', 'Bình Dương', 'Tỉnh Bình Dương', true, 12),
('province', '75', 'Đồng Nai', 'Tỉnh Đồng Nai', true, 13),
('province', '77', 'Bà Rịa – Vũng Tàu', 'Tỉnh Bà Rịa – Vũng Tàu', true, 14),
('province', '80', 'Long An', 'Tỉnh Long An', true, 15),
('province', '82', 'Tiền Giang', 'Tỉnh Tiền Giang', true, 16),
('province', '83', 'Bến Tre', 'Tỉnh Bến Tre', true, 17),
('province', '84', 'Trà Vinh', 'Tỉnh Trà Vinh', true, 18),
('province', '86', 'Vĩnh Long', 'Tỉnh Vĩnh Long', true, 19),
('province', '87', 'Đồng Tháp', 'Tỉnh Đồng Tháp', true, 20),
('province', '89', 'An Giang', 'Tỉnh An Giang', true, 21),
('province', '91', 'Kiên Giang', 'Tỉnh Kiên Giang', true, 22),
('province', '92', 'Cần Thơ', 'Thành phố Cần Thơ', true, 23),
('province', '93', 'Hậu Giang', 'Tỉnh Hậu Giang', true, 24),
('province', '94', 'Sóc Trăng', 'Tỉnh Sóc Trăng', true, 25);

-- 2. Cập nhật bảng material_zones (Khai báo vùng trồng)
DELETE FROM material_zones;

INSERT INTO material_zones (code, name, province, location, certification, notes, is_active)
VALUES
('VN-54-01', 'Vùng trồng Phú Yên', 'Tỉnh Phú Yên', 'Tỉnh Phú Yên', 'Mã số PUC xuất khẩu', 'Mã hành chính: 54', true),
('VN-56-01', 'Vùng trồng Khánh Hòa', 'Tỉnh Khánh Hòa', 'Tỉnh Khánh Hòa', 'Mã số PUC xuất khẩu', 'Mã hành chính: 56', true),
('VN-58-01', 'Vùng trồng Ninh Thuận', 'Tỉnh Ninh Thuận', 'Tỉnh Ninh Thuận', 'Mã số PUC xuất khẩu', 'Mã hành chính: 58', true),
('VN-60-01', 'Vùng trồng Bình Thuận', 'Tỉnh Bình Thuận', 'Tỉnh Bình Thuận', 'Mã số PUC xuất khẩu', 'Mã hành chính: 60', true),
('VN-62-01', 'Vùng trồng Kon Tum', 'Tỉnh Kon Tum', 'Tỉnh Kon Tum', 'Mã số PUC xuất khẩu', 'Mã hành chính: 62', true),
('VN-64-01', 'Vùng trồng Gia Lai', 'Tỉnh Gia Lai', 'Tỉnh Gia Lai', 'Mã số PUC xuất khẩu', 'Mã hành chính: 64', true),
('VN-66-01', 'Vùng trồng Đắk Lắk', 'Tỉnh Đắk Lắk', 'Tỉnh Đắk Lắk', 'Mã số PUC xuất khẩu', 'Mã hành chính: 66', true),
('VN-67-01', 'Vùng trồng Đắk Nông', 'Tỉnh Đắk Nông', 'Tỉnh Đắk Nông', 'Mã số PUC xuất khẩu', 'Mã hành chính: 67', true),
('VN-68-01', 'Vùng trồng Lâm Đồng', 'Tỉnh Lâm Đồng', 'Tỉnh Lâm Đồng', 'Mã số PUC xuất khẩu', 'Mã hành chính: 68', true),
('VN-70-01', 'Vùng trồng Bình Phước', 'Tỉnh Bình Phước', 'Tỉnh Bình Phước', 'Mã số PUC xuất khẩu', 'Mã hành chính: 70', true),
('VN-72-01', 'Vùng trồng Tây Ninh', 'Tỉnh Tây Ninh', 'Tỉnh Tây Ninh', 'Mã số PUC xuất khẩu', 'Mã hành chính: 72', true),
('VN-74-01', 'Vùng trồng Bình Dương', 'Tỉnh Bình Dương', 'Tỉnh Bình Dương', 'Mã số PUC xuất khẩu', 'Mã hành chính: 74', true),
('VN-75-01', 'Vùng trồng Đồng Nai', 'Tỉnh Đồng Nai', 'Tỉnh Đồng Nai', 'Mã số PUC xuất khẩu', 'Mã hành chính: 75', true),
('VN-77-01', 'Vùng trồng Bà Rịa – Vũng Tàu', 'Tỉnh Bà Rịa – Vũng Tàu', 'Tỉnh Bà Rịa – Vũng Tàu', 'Mã số PUC xuất khẩu', 'Mã hành chính: 77', true),
('VN-80-01', 'Vùng trồng Long An', 'Tỉnh Long An', 'Tỉnh Long An', 'Mã số PUC xuất khẩu', 'Mã hành chính: 80', true),
('VN-82-01', 'Vùng trồng Tiền Giang', 'Tỉnh Tiền Giang', 'Tỉnh Tiền Giang', 'Mã số PUC xuất khẩu', 'Mã hành chính: 82', true),
('VN-83-01', 'Vùng trồng Bến Tre', 'Tỉnh Bến Tre', 'Tỉnh Bến Tre', 'Mã số PUC xuất khẩu', 'Mã hành chính: 83', true),
('VN-84-01', 'Vùng trồng Trà Vinh', 'Tỉnh Trà Vinh', 'Tỉnh Trà Vinh', 'Mã số PUC xuất khẩu', 'Mã hành chính: 84', true),
('VN-86-01', 'Vùng trồng Vĩnh Long', 'Tỉnh Vĩnh Long', 'Tỉnh Vĩnh Long', 'Mã số PUC xuất khẩu', 'Mã hành chính: 86', true),
('VN-87-01', 'Vùng trồng Đồng Tháp', 'Tỉnh Đồng Tháp', 'Tỉnh Đồng Tháp', 'Mã số PUC xuất khẩu', 'Mã hành chính: 87', true),
('VN-89-01', 'Vùng trồng An Giang', 'Tỉnh An Giang', 'Tỉnh An Giang', 'Mã số PUC xuất khẩu', 'Mã hành chính: 89', true),
('VN-91-01', 'Vùng trồng Kiên Giang', 'Tỉnh Kiên Giang', 'Tỉnh Kiên Giang', 'Mã số PUC xuất khẩu', 'Mã hành chính: 91', true),
('VN-92-01', 'Vùng trồng Cần Thơ', 'Thành phố Cần Thơ', 'Thành phố Cần Thơ', 'Mã số PUC xuất khẩu', 'Mã hành chính: 92', true),
('VN-93-01', 'Vùng trồng Hậu Giang', 'Tỉnh Hậu Giang', 'Tỉnh Hậu Giang', 'Mã số PUC xuất khẩu', 'Mã hành chính: 93', true),
('VN-94-01', 'Vùng trồng Sóc Trăng', 'Tỉnh Sóc Trăng', 'Tỉnh Sóc Trăng', 'Mã số PUC xuất khẩu', 'Mã hành chính: 94', true);

NOTIFY pgrst, 'reload schema';
