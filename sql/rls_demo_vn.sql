-- Kích hoạt bảo mật cấp hàng (RLS)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách: "Người dùng chỉ được thấy dữ liệu thuộc hệ thống họ đang chọn"
-- Giả sử ta truyền biến 'app.current_system' vào mỗi lần gọi API
CREATE POLICY "Strict Isolation Policy" ON products
FOR ALL
USING (
    system_type = current_setting('app.current_system')::system_type_enum
);

-- Khi áp dụng chính sách này:
-- * SELECT * FROM products; -> Trả về rỗng (0 dòng)
-- * SET app.current_system = 'PACKAGING'; SELECT * FROM products; -> Chỉ trả về bao bì
-- * Dù lập trình viên có quên "WHERE", database cũng tự chặn lại.
