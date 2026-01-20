-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    module TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Separate 'Roles' and 'Permissions' logic
-- Currently roles have 'permissions' array which will store the 'code' from permissions table

-- Insert some default permissions based on current usage
INSERT INTO permissions (code, name, module, description) VALUES
('product.view', 'Xem sản phẩm', 'Sản phẩm', 'Cho phép xem danh sách và chi tiết sản phẩm'),
('product.create', 'Thêm sản phẩm', 'Sản phẩm', 'Cho phép tạo mới sản phẩm'),
('product.edit', 'Sửa sản phẩm', 'Sản phẩm', 'Cho phép chỉnh sửa thông tin sản phẩm'),
('product.delete', 'Xóa sản phẩm', 'Sản phẩm', 'Cho phép xóa sản phẩm'),

('inventory.view', 'Xem tồn kho', 'Kho', 'Cho phép xem báo cáo tồn kho'),
('inventory.adjust', 'Kiểm kê/Điều chỉnh', 'Kho', 'Cho phép điều chỉnh số lượng tồn kho'),

('inbound.view', 'Xem nhập kho', 'Nhập kho', 'Cho phép xem lịch sử nhập kho'),
('inbound.create', 'Tạo phiếu nhập', 'Nhập kho', 'Cho phép tạo phiếu nhập kho mới'),

('outbound.view', 'Xem xuất kho', 'Xuất kho', 'Cho phép xem lịch sử xuất kho'),
('outbound.create', 'Tạo phiếu xuất', 'Xuất kho', 'Cho phép tạo phiếu xuất kho mới'),

('partner.view', 'Xem đối tác', 'Đối tác', 'Xem danh sách khách hàng và nhà cung cấp'),
('partner.edit', 'Quản lý đối tác', 'Đối tác', 'Thêm/Sửa/Xóa khách hàng và nhà cung cấp'),

('user.view', 'Xem người dùng', 'Hệ thống', 'Xem danh sách người dùng'),
('user.manage', 'Quản lý người dùng', 'Hệ thống', 'Tạo, sửa, phân quyền người dùng'),

('report.view', 'Xem báo cáo', 'Báo cáo', 'Xem các báo cáo doanh thu, công nợ')
ON CONFLICT (code) DO NOTHING;

-- Grant access (if using RLS, we might need policies, but for now assuming authenticated users can read)
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON permissions
    FOR SELECT USING (true);

CREATE POLICY "Enable write access for admins only" ON permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM roles
                WHERE roles.id = user_profiles.role_id
                AND roles.code = 'ADMIN'
            )
        )
    );
