-- =============================================================================
-- RESTORE ROLES AND FIX PERMISSIONS (FIXED TYPE ERROR)
-- =============================================================================

-- 1. SEED DATA (Fixed JSONB casting)
INSERT INTO public.roles (code, name, description, permissions) VALUES
('MANAGER', 'Quản lý', 'Quản lý chung, có quyền cao nhất sau Admin', to_jsonb(ARRAY['warehouse.view', 'warehouse.manage', 'inventory.view', 'inventory.manage', 'report.view']::text[])),
('STAFF', 'Nhân viên Kho', 'Thực hiện nhập xuất và kiểm kê kho', to_jsonb(ARRAY['warehouse.view', 'inventory.view', 'inventory.manage']::text[])),
('ACCOUNTANT', 'Kế toán', 'Xem báo cáo và quản lý chứng từ', to_jsonb(ARRAY['warehouse.view', 'report.view', 'inventory.view']::text[])),
('SALES', 'Kinh doanh', 'Xem tồn kho và tạo đơn hàng', to_jsonb(ARRAY['warehouse.view', 'inventory.view']::text[]))
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    permissions = EXCLUDED.permissions;

-- 2. FIX PERMISSIONS
-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Clean old policies
DO $$ 
BEGIN 
    BEGIN EXECUTE 'DROP POLICY "authenticated_access_roles" ON public.roles'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "allow_read_roles" ON public.roles'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "roles_read_policy" ON public.roles'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- Create Policy
CREATE POLICY "allow_read_roles" ON public.roles
FOR SELECT TO authenticated
USING (true);

-- Grant Permissions
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
