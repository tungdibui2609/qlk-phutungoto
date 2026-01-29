-- =============================================================================
-- SEED PERMISSIONS (SYNC WITH ROLES)
-- =============================================================================

INSERT INTO public.permissions (code, name, module, description) VALUES
-- Module: Kho vận (Warehouse)
('warehouse.view', 'Xem Danh sách Kho', 'Kho vận', 'Cho phép xem danh sách và thông tin chi tiết các kho'),
('warehouse.manage', 'Quản lý Kho', 'Kho vận', 'Cho phép thêm, sửa, xóa và cấu hình kho'),

-- Module: Hàng hóa (Inventory)
('inventory.view', 'Xem Tồn kho', 'Hàng hóa', 'Cho phép xem số lượng tồn kho và lô hàng'),
('inventory.manage', 'Quản lý Tồn kho', 'Hàng hóa', 'Cho phép nhập kho, xuất kho, điều chuyển và kiểm kê'),

-- Module: Báo cáo (Reports)
('report.view', 'Xem Báo cáo', 'Báo cáo', 'Cho phép truy cập các báo cáo thống kê'),

-- Module: Hệ thống (System)
('system.full_access', 'Quản trị hệ thống', 'Hệ thống', 'Quyền cao nhất, quản lý toàn bộ hệ thống')

ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    module = EXCLUDED.module,
    description = EXCLUDED.description;

-- Grant access to permissions table
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
    BEGIN EXECUTE 'DROP POLICY "read_permissions" ON public.permissions'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

CREATE POLICY "read_permissions" ON public.permissions FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.permissions TO authenticated;
