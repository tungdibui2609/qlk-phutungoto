-- =============================================================================
-- REPAIR PERMISSIONS TABLE & DATA
-- Chạy file này trong Supabase SQL Editor để khắc phục lỗi bảng phân quyền trống
-- =============================================================================

-- 1. Đảm bảo bảng permissions tồn tại với cấu trúc đúng
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    module TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Cho phép quyền truy cập (RLS & Grant)
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Xóa policy cũ nếu có để tránh lỗi
DO $$ 
BEGIN 
    BEGIN EXECUTE 'DROP POLICY "read_permissions" ON public.permissions'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "allow_read_permissions_all" ON public.permissions'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Tạo policy mới cho phép mọi user đã đăng nhập được đọc bảng này
CREATE POLICY "allow_read_permissions_all" ON public.permissions 
FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

-- 3. Nạp dữ liệu permissions (Seed data)
-- Sử dụng ON CONFLICT để cập nhật nếu đã tồn tại
INSERT INTO public.permissions (code, name, module, description) VALUES
('product.view', 'Xem Sản phẩm', 'Hàng hóa', 'Xem danh sách sản phẩm'),
('product.manage', 'Quản lý Sản phẩm', 'Hàng hóa', 'Thêm, sửa, xóa sản phẩm'),
('category.view', 'Xem Danh mục', 'Hàng hóa', 'Xem danh mục sản phẩm'),
('category.manage', 'Quản lý Danh mục', 'Hàng hóa', 'Thêm, sửa, xóa danh mục'),
('unit.view', 'Xem Đơn vị', 'Hàng hóa', 'Xem danh sách đơn vị tính'),
('unit.manage', 'Quản lý Đơn vị', 'Hàng hóa', 'Thêm, sửa, xóa đơn vị tính'),
('origin.view', 'Xem Xuất xứ', 'Hàng hóa', 'Xem danh sách xuất xứ'),
('origin.manage', 'Quản lý Xuất xứ', 'Hàng hóa', 'Thêm, sửa, xóa xuất xứ'),
('vehicle.view', 'Xem Dòng xe', 'Hàng hóa', 'Xem danh sách dòng xe'),
('vehicle.manage', 'Quản lý Dòng xe', 'Hàng hóa', 'Thêm, sửa, xóa dòng xe'),
('partner.view', 'Xem Đối tác', 'Đối tác', 'Xem khách hàng và nhà cung cấp'),
('partner.manage', 'Quản lý Đối tác', 'Đối tác', 'Thêm, sửa, xóa NCC và khách hàng'),
('warehouse.view', 'Xem Kho hàng', 'Kho vận', 'Xem danh sách kho và vị trí'),
('warehouse.manage', 'Quản lý Kho hàng', 'Kho vận', 'Thêm, sửa, xóa kho và vị trí'),
('warehousemap.manage', 'Thiết kế sơ đồ', 'Kho vận', 'Thiết kế layout sơ đồ vị trí kho'),
('inventory.view', 'Xem Tồn kho', 'Hàng hóa', 'Xem báo cáo tồn kho'),
('inventory.manage', 'Quản lý Tồn kho', 'Hàng hóa', 'Điều chỉnh tồn kho'),
('lotcode.view', 'Xem Mã lô', 'Kho vận', 'Xem danh sách mã lô'),
('lotcode.manage', 'Quản lý Mã lô', 'Kho vận', 'Thêm, xóa mã lô'),
('lot.view', 'Xem LOT', 'Kho vận', 'Xem danh sách lô hàng'),
('lot.manage', 'Quản lý LOT', 'Kho vận', 'Tạo, sửa, xóa, tách, gộp, xuất lô'),
('order.view', 'Xem Phiếu nhập/xuất', 'Đơn hàng', 'Xem danh sách phiếu'),
('order.manage', 'Quản lý Phiếu nhập/xuất', 'Đơn hàng', 'Tạo, sửa, xóa phiếu'),
('qc.view', 'Xem QC', 'Kho vận', 'Xem danh sách kiểm hàng'),
('qc.manage', 'Quản lý QC', 'Kho vận', 'Tạo và cập nhật phiếu QC'),
('site_inventory.view', 'Xem Kho công trình', 'Kho vận', 'Xem tồn kho tại công trình'),
('site_inventory.manage', 'Quản lý Kho công trình', 'Kho vận', 'Xuất nhập kho công trình'),
('report.view', 'Xem Báo cáo', 'Báo cáo', 'Xem các báo cáo hệ thống'),
('system.full_access', 'Quản trị hệ thống', 'Hệ thống', 'Quyên cao nhất, quản lý toàn bộ hệ thống')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    module = EXCLUDED.module,
    description = EXCLUDED.description;

-- 4. Thông báo kết quả
SELECT count(*) as total_permissions FROM public.permissions;
