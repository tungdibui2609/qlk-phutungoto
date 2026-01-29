-- =============================================================================
-- FINAL FIX: ROLES & PERMISSIONS (SAFE INSERT)
-- =============================================================================

-- 1. SEED PERMISSIONS (Standard System Permissions)
-- Using WHERE NOT EXISTS to avoid "ON CONFLICT" errors if constraints are missing
INSERT INTO public.permissions (code, name, module, description)
SELECT 'warehouse.view', 'Xem Danh sách Kho', 'Kho vận', 'Cho phép xem danh sách và thông tin chi tiết các kho'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'warehouse.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'warehouse.manage', 'Quản lý Kho', 'Kho vận', 'Cho phép thêm, sửa, xóa và cấu hình kho'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'warehouse.manage');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'inventory.view', 'Xem Tồn kho', 'Hàng hóa', 'Cho phép xem số lượng tồn kho và lô hàng'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'inventory.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'inventory.manage', 'Quản lý Tồn kho', 'Hàng hóa', 'Cho phép nhập kho, xuất kho, điều chuyển và kiểm kê'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'inventory.manage');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'report.view', 'Xem Báo cáo', 'Báo cáo', 'Cho phép truy cập các báo cáo thống kê'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'report.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'system.full_access', 'Quản trị hệ thống', 'Hệ thống', 'Quyền cao nhất, quản lý toàn bộ hệ thống'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'system.full_access');


-- 2. SEED ROLES (Default Roles with JSONB Permissions)
INSERT INTO public.roles (code, name, description, permissions)
SELECT 'MANAGER', 'Quản lý', 'Quản lý chung, có quyền cao nhất sau Admin', 
to_jsonb(ARRAY['warehouse.view', 'warehouse.manage', 'inventory.view', 'inventory.manage', 'report.view']::text[])
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'MANAGER');

INSERT INTO public.roles (code, name, description, permissions)
SELECT 'STAFF', 'Nhân viên Kho', 'Thực hiện nhập xuất và kiểm kê kho', 
to_jsonb(ARRAY['warehouse.view', 'inventory.view', 'inventory.manage']::text[])
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'STAFF');

INSERT INTO public.roles (code, name, description, permissions)
SELECT 'ACCOUNTANT', 'Kế toán', 'Xem báo cáo và quản lý chứng từ', 
to_jsonb(ARRAY['warehouse.view', 'report.view', 'inventory.view']::text[])
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'ACCOUNTANT');

INSERT INTO public.roles (code, name, description, permissions)
SELECT 'SALES', 'Kinh doanh', 'Xem tồn kho và tạo đơn hàng', 
to_jsonb(ARRAY['warehouse.view', 'inventory.view']::text[])
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'SALES');


-- 3. FIX PERMISSIONS (RLS) FOR BOTH TABLES
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    -- Roles Policies
    BEGIN EXECUTE 'DROP POLICY "allow_read_roles" ON public.roles'; EXCEPTION WHEN OTHERS THEN NULL; END;
    
    -- Permissions Policies
    BEGIN EXECUTE 'DROP POLICY "read_permissions" ON public.permissions'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Re-create Policies
CREATE POLICY "allow_read_roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_permissions" ON public.permissions FOR SELECT TO authenticated USING (true);

-- Grant Permissions
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;

-- Grant Service Role full access
GRANT ALL ON public.roles TO service_role;
GRANT ALL ON public.permissions TO service_role;

