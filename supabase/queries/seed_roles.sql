-- =============================================================================
-- SEED DEFAULT ROLES
-- =============================================================================

INSERT INTO public.roles (code, name, description, permissions) VALUES
('MANAGER', 'Quản lý', 'Quản lý chung, có quyền cao nhất sau Admin', ARRAY['warehouse.view', 'warehouse.manage', 'inventory.view', 'inventory.manage', 'report.view']),
('STAFF', 'Nhân viên Kho', 'Thực hiện nhập xuất và kiểm kê kho', ARRAY['warehouse.view', 'inventory.view', 'inventory.manage']),
('ACCOUNTANT', 'Kế toán', 'Xem báo cáo và quản lý chứng từ', ARRAY['warehouse.view', 'report.view', 'inventory.view']),
('SALES', 'Kinh doanh', 'Xem tồn kho và tạo đơn hàng', ARRAY['warehouse.view', 'inventory.view'])
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Grant permission just in case
GRANT SELECT ON public.roles TO authenticated;
