-- =============================================================================
-- UPDATE COMPREHENSIVE PERMISSIONS
-- Chạy file này trong Supabase SQL Editor để thêm tất cả permissions
-- =============================================================================

-- 1. PRODUCT (Sản phẩm)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'product.view', 'Xem Sản phẩm', 'Hàng hóa', 'Xem danh sách sản phẩm'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'product.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'product.manage', 'Quản lý Sản phẩm', 'Hàng hóa', 'Thêm, sửa, xóa sản phẩm'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'product.manage');

-- 2. CATEGORY (Danh mục)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'category.view', 'Xem Danh mục', 'Hàng hóa', 'Xem danh mục sản phẩm'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'category.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'category.manage', 'Quản lý Danh mục', 'Hàng hóa', 'Thêm, sửa, xóa danh mục'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'category.manage');

-- 3. UNIT (Đơn vị tính)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'unit.view', 'Xem Đơn vị', 'Hàng hóa', 'Xem danh sách đơn vị tính'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'unit.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'unit.manage', 'Quản lý Đơn vị', 'Hàng hóa', 'Thêm, sửa, xóa đơn vị tính'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'unit.manage');

-- 4. ORIGIN (Xuất xứ)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'origin.view', 'Xem Xuất xứ', 'Hàng hóa', 'Xem danh sách xuất xứ'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'origin.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'origin.manage', 'Quản lý Xuất xứ', 'Hàng hóa', 'Thêm, sửa, xóa xuất xứ'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'origin.manage');

-- 5. VEHICLES (Dòng xe)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'vehicle.view', 'Xem Dòng xe', 'Hàng hóa', 'Xem danh sách dòng xe'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'vehicle.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'vehicle.manage', 'Quản lý Dòng xe', 'Hàng hóa', 'Thêm, sửa, xóa dòng xe'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'vehicle.manage');

-- 6. PARTNERS (Khách hàng, NCC)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'partner.view', 'Xem Đối tác', 'Đối tác', 'Xem khách hàng và nhà cung cấp'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'partner.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'partner.manage', 'Quản lý Đối tác', 'Đối tác', 'Thêm, sửa, xóa NCC và khách hàng'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'partner.manage');

-- 7. WAREHOUSE (Kho hàng)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'warehouse.view', 'Xem Kho hàng', 'Kho vận', 'Xem danh sách kho và vị trí'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'warehouse.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'warehouse.manage', 'Quản lý Kho hàng', 'Kho vận', 'Thêm, sửa, xóa kho và vị trí'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'warehouse.manage');

-- 8. WAREHOUSE MAP (Thiết kế sơ đồ kho - riêng biệt)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'warehousemap.manage', 'Thiết kế sơ đồ', 'Kho vận', 'Thiết kế layout sơ đồ vị trí kho'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'warehousemap.manage');

-- 9. INVENTORY (Tồn kho)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'inventory.view', 'Xem Tồn kho', 'Kho vận', 'Xem báo cáo tồn kho'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'inventory.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'inventory.manage', 'Quản lý Tồn kho', 'Kho vận', 'Điều chỉnh tồn kho'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'inventory.manage');

-- 10. LOT CODE (Mã lô)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'lotcode.view', 'Xem Mã lô', 'Kho vận', 'Xem danh sách mã lô'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'lotcode.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'lotcode.manage', 'Quản lý Mã lô', 'Kho vận', 'Thêm, xóa mã lô'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'lotcode.manage');

-- 11. LOT (Quản lý LOT)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'lot.view', 'Xem LOT', 'Kho vận', 'Xem danh sách lô hàng'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'lot.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'lot.manage', 'Quản lý LOT', 'Kho vận', 'Tạo, sửa, xóa, tách, gộp, xuất lô'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'lot.manage');

-- 12. ORDERS (Phiếu nhập/xuất)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'order.view', 'Xem Phiếu nhập/xuất', 'Đơn hàng', 'Xem danh sách phiếu'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'order.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'order.manage', 'Quản lý Phiếu nhập/xuất', 'Đơn hàng', 'Tạo, sửa, xóa phiếu'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'order.manage');

-- 13. QC (Kiểm soát chất lượng)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'qc.view', 'Xem QC', 'Kho vận', 'Xem danh sách kiểm hàng'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'qc.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'qc.manage', 'Quản lý QC', 'Kho vận', 'Tạo và cập nhật phiếu QC'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'qc.manage');

-- 14. SITE INVENTORY (Kho công trình)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'site_inventory.view', 'Xem Kho công trình', 'Kho vận', 'Xem tồn kho tại công trình'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'site_inventory.view');

INSERT INTO public.permissions (code, name, module, description)
SELECT 'site_inventory.manage', 'Quản lý Kho công trình', 'Kho vận', 'Xuất nhập kho công trình'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'site_inventory.manage');

-- 15. REPORT (Báo cáo)
INSERT INTO public.permissions (code, name, module, description)
SELECT 'report.view', 'Xem Báo cáo', 'Báo cáo', 'Xem các báo cáo hệ thống'
WHERE NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'report.view');

-- =============================================================================
-- SUMMARY: 15 features with 29 permissions total
-- =============================================================================
-- product.view, product.manage
-- category.view, category.manage
-- unit.view, unit.manage
-- origin.view, origin.manage
-- vehicle.view, vehicle.manage
-- partner.view, partner.manage
-- warehouse.view, warehouse.manage
-- warehousemap.manage (Thiết kế sơ đồ - riêng biệt)
-- inventory.view, inventory.manage
-- lotcode.view, lotcode.manage (Mã lô)
-- lot.view, lot.manage (Quản lý LOT)
-- order.view, order.manage
-- qc.view, qc.manage
-- site_inventory.view, site_inventory.manage
-- report.view
-- =============================================================================
