-- Đảm bảo mã vùng trồng là duy nhất
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'material_zones_code_unique'
    ) THEN
        ALTER TABLE material_zones ADD CONSTRAINT material_zones_code_unique UNIQUE (code);
    END IF;
END $$;

INSERT INTO material_zones (code, name, province, location, certification, notes, is_active)
VALUES
('VN-01-01', 'Vùng trồng Hà Nội', 'Thành phố Hà Nội', 'Thành phố Hà Nội', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 01', true),
('VN-02-01', 'Vùng trồng Hà Giang', 'Tỉnh Hà Giang', 'Tỉnh Hà Giang', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 02', true),
('VN-04-01', 'Vùng trồng Cao Bằng', 'Tỉnh Cao Bằng', 'Tỉnh Cao Bằng', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 04', true),
('VN-06-01', 'Vùng trồng Bắc Kạn', 'Tỉnh Bắc Kạn', 'Tỉnh Bắc Kạn', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 06', true),
('VN-08-01', 'Vùng trồng Tuyên Quang', 'Tỉnh Tuyên Quang', 'Tỉnh Tuyên Quang', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 08', true),
('VN-11-01', 'Vùng trồng Điện Biên', 'Tỉnh Điện Biên', 'Tỉnh Điện Biên', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 11', true),
('VN-12-01', 'Vùng trồng Lai Châu', 'Tỉnh Lai Châu', 'Tỉnh Lai Châu', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 12', true),
('VN-14-01', 'Vùng trồng Sơn La', 'Tỉnh Sơn La', 'Tỉnh Sơn La', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 14', true),
('VN-15-01', 'Vùng trồng Lào Cai', 'Tỉnh Lào Cai', 'Tỉnh Lào Cai', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 15', true),
('VN-17-01', 'Vùng trồng Hòa Bình', 'Tỉnh Hòa Bình', 'Tỉnh Hòa Bình', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 17', true),
('VN-19-01', 'Vùng trồng Thái Nguyên', 'Tỉnh Thái Nguyên', 'Tỉnh Thái Nguyên', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 19', true),
('VN-20-01', 'Vùng trồng Lạng Sơn', 'Tỉnh Lạng Sơn', 'Tỉnh Lạng Sơn', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 20', true),
('VN-22-01', 'Vùng trồng Quảng Ninh', 'Tỉnh Quảng Ninh', 'Tỉnh Quảng Ninh', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 22', true),
('VN-24-01', 'Vùng trồng Bắc Ninh', 'Tỉnh Bắc Ninh', 'Tỉnh Bắc Ninh', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 24', true),
('VN-25-01', 'Vùng trồng Phú Thọ', 'Tỉnh Phú Thọ', 'Tỉnh Phú Thọ', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 25', true),
('VN-26-01', 'Vùng trồng Vĩnh Phúc', 'Tỉnh Vĩnh Phúc', 'Tỉnh Vĩnh Phúc', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 26', true),
('VN-27-01', 'Vùng trồng Bắc Giang', 'Tỉnh Bắc Giang', 'Tỉnh Bắc Giang', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 27', true),
('VN-30-01', 'Vùng trồng Hải Dương', 'Tỉnh Hải Dương', 'Tỉnh Hải Dương', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 30', true),
('VN-31-01', 'Vùng trồng Hải Phòng', 'Thành phố Hải Phòng', 'Thành phố Hải Phòng', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 31', true),
('VN-33-01', 'Vùng trồng Hưng Yên', 'Tỉnh Hưng Yên', 'Tỉnh Hưng Yên', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 33', true),
('VN-34-01', 'Vùng trồng Thái Bình', 'Tỉnh Thái Bình', 'Tỉnh Thái Bình', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 34', true),
('VN-35-01', 'Vùng trồng Hà Nam', 'Tỉnh Hà Nam', 'Tỉnh Hà Nam', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 35', true),
('VN-36-01', 'Vùng trồng Nam Định', 'Tỉnh Nam Định', 'Tỉnh Nam Định', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 36', true),
('VN-37-01', 'Vùng trồng Ninh Bình', 'Tỉnh Ninh Bình', 'Tỉnh Ninh Bình', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 37', true),
('VN-38-01', 'Vùng trồng Thanh Hóa', 'Tỉnh Thanh Hóa', 'Tỉnh Thanh Hóa', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 38', true),
('VN-40-01', 'Vùng trồng Nghệ An', 'Tỉnh Nghệ An', 'Tỉnh Nghệ An', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 40', true),
('VN-42-01', 'Vùng trồng Hà Tĩnh', 'Tỉnh Hà Tĩnh', 'Tỉnh Hà Tĩnh', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 42', true),
('VN-44-01', 'Vùng trồng Quảng Trị', 'Tỉnh Quảng Trị', 'Tỉnh Quảng Trị', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 44', true),
('VN-45-01', 'Vùng trồng Quảng Bình', 'Tỉnh Quảng Bình', 'Tỉnh Quảng Bình', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 45', true),
('VN-46-01', 'Vùng trồng Thừa Thiên Huế', 'Thành phố Huế', 'Thành phố Huế', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 46', true),
('VN-48-01', 'Vùng trồng Đà Nẵng', 'Thành phố Đà Nẵng', 'Thành phố Đà Nẵng', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 48', true),
('VN-49-01', 'Vùng trồng Quảng Nam', 'Tỉnh Quảng Nam', 'Tỉnh Quảng Nam', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 49', true),
('VN-51-01', 'Vùng trồng Quảng Ngãi', 'Tỉnh Quảng Ngãi', 'Tỉnh Quảng Ngãi', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 51', true),
('VN-52-01', 'Vùng trồng Gia Lai', 'Tỉnh Gia Lai', 'Tỉnh Gia Lai', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 52', true),
('VN-54-01', 'Vùng trồng Phú Yên', 'Tỉnh Phú Yên', 'Tỉnh Phú Yên', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 54', true),
('VN-56-01', 'Vùng trồng Khánh Hòa', 'Tỉnh Khánh Hòa', 'Tỉnh Khánh Hòa', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 56', true),
('VN-58-01', 'Vùng trồng Ninh Thuận', 'Tỉnh Ninh Thuận', 'Tỉnh Ninh Thuận', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 58', true),
('VN-60-01', 'Vùng trồng Bình Thuận', 'Tỉnh Bình Thuận', 'Tỉnh Bình Thuận', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 60', true),
('VN-62-01', 'Vùng trồng Kon Tum', 'Tỉnh Kon Tum', 'Tỉnh Kon Tum', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 62', true),
('VN-64-01', 'Vùng trồng Bình Định', 'Tỉnh Bình Định', 'Tỉnh Bình Định', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 64', true),
('VN-66-01', 'Vùng trồng Đắk Lắk', 'Tỉnh Đắk Lắk', 'Tỉnh Đắk Lắk', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 66', true),
('VN-67-01', 'Vùng trồng Đắk Nông', 'Tỉnh Đắk Nông', 'Tỉnh Đắk Nông', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 67', true),
('VN-68-01', 'Vùng trồng Lâm Đồng', 'Tỉnh Lâm Đồng', 'Tỉnh Lâm Đồng', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 68', true),
('VN-70-01', 'Vùng trồng Bình Phước', 'Tỉnh Bình Phước', 'Tỉnh Bình Phước', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 70', true),
('VN-72-01', 'Vùng trồng Bà Rịa - Vũng Tàu', 'Tỉnh Bà Rịa - Vũng Tàu', 'Tỉnh Bà Rịa - Vũng Tàu', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 72', true),
('VN-74-01', 'Vùng trồng Bình Dương', 'Tỉnh Bình Dương', 'Tỉnh Bình Dương', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 74', true),
('VN-75-01', 'Vùng trồng Đồng Nai', 'Tỉnh Đồng Nai', 'Tỉnh Đồng Nai', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 75', true),
('VN-79-01', 'Vùng trồng TP. Hồ Chí Minh', 'Thành phố Hồ Chí Minh', 'Thành phố Hồ Chí Minh', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 79', true),
('VN-80-01', 'Vùng trồng Tây Ninh', 'Tỉnh Tây Ninh', 'Tỉnh Tây Ninh', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 80', true),
('VN-82-01', 'Vùng trồng Đồng Tháp', 'Tỉnh Đồng Tháp', 'Tỉnh Đồng Tháp', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 82', true),
('VN-83-01', 'Vùng trồng Tiền Giang', 'Tỉnh Tiền Giang', 'Tỉnh Tiền Giang', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 83', true),
('VN-84-01', 'Vùng trồng Bến Tre', 'Tỉnh Bến Tre', 'Tỉnh Bến Tre', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 84', true),
('VN-86-01', 'Vùng trồng Vĩnh Long', 'Tỉnh Vĩnh Long', 'Tỉnh Vĩnh Long', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 86', true),
('VN-87-01', 'Vùng trồng Long An', 'Tỉnh Long An', 'Tỉnh Long An', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 87', true),
('VN-89-01', 'Vùng trồng Trà Vinh', 'Tỉnh Trà Vinh', 'Tỉnh Trà Vinh', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 89', true),
('VN-91-01', 'Vùng trồng An Giang', 'Tỉnh An Giang', 'Tỉnh An Giang', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 91', true),
('VN-92-01', 'Vùng trồng Cần Thơ', 'Thành phố Cần Thơ', 'Thành phố Cần Thơ', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 92', true),
('VN-93-01', 'Vùng trồng Hậu Giang', 'Tỉnh Hậu Giang', 'Tỉnh Hậu Giang', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 93', true),
('VN-94-01', 'Vùng trồng Sóc Trăng', 'Tỉnh Sóc Trăng', 'Tỉnh Sóc Trăng', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 94', true),
('VN-95-01', 'Vùng trồng Bạc Liêu', 'Tỉnh Bạc Liêu', 'Tỉnh Bạc Liêu', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 95', true),
('VN-96-01', 'Vùng trồng Cà Mau', 'Tỉnh Cà Mau', 'Tỉnh Cà Mau', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 96', true),
('VN-97-01', 'Vùng trồng Kiên Giang', 'Tỉnh Kiên Giang', 'Tỉnh Kiên Giang', 'Mã số PUC xuất khẩu', 'Mã hành chính tỉnh: 97', true)
ON CONFLICT (code) DO UPDATE 
SET province = EXCLUDED.province,
    location = EXCLUDED.location,
    name = EXCLUDED.name,
    certification = EXCLUDED.certification,
    notes = EXCLUDED.notes;

NOTIFY pgrst, 'reload schema';
