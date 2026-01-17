-- ============================================
-- MIGRATION: Quản lý Người dùng & Phân quyền
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Bảng Vai trò (Roles)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Bảng Hồ sơ người dùng (User Profiles)
-- Liên kết với auth.users của Supabase
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    avatar_url TEXT,
    role_id UUID REFERENCES roles(id),
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_roles_code ON roles(code);

-- 4. Seed các vai trò mặc định
INSERT INTO roles (code, name, description, permissions, is_system) VALUES
('admin', 'Quản trị viên', 'Toàn quyền quản lý hệ thống', 
    '["all"]'::jsonb, true),
('manager', 'Quản lý', 'Quản lý kho, sản phẩm, nhân viên', 
    '["products.view", "products.edit", "inventory.view", "inventory.edit", "reports.view"]'::jsonb, true),
('warehouse', 'Thủ kho', 'Quản lý nhập xuất kho', 
    '["inventory.view", "inventory.edit", "operations.inbound", "operations.outbound"]'::jsonb, true),
('sales', 'Nhân viên bán hàng', 'Xem sản phẩm, tạo đơn xuất', 
    '["products.view", "customers.view", "customers.edit", "operations.outbound"]'::jsonb, true),
('viewer', 'Xem báo cáo', 'Chỉ xem báo cáo và thống kê', 
    '["reports.view", "products.view", "inventory.view"]'::jsonb, true)
ON CONFLICT (code) DO NOTHING;

-- 5. Trigger cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Done!
SELECT 'User management tables created!' as status;
