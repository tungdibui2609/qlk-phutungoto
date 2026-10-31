-- Đăng ký module "Tồn theo Lệnh sản xuất" vào danh mục module trung tâm.
-- Module này bật/tắt theo phân hệ kho (Cài đặt phân hệ → Tính năng → Báo cáo),
-- không hardcode mã kho: kho nào bật thì tab "Tồn theo Lệnh SX" tự hiện.
INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES
    ('report_inventory_by_production', 'Tồn theo Lệnh sản xuất', 'Tab tồn kho gom theo lệnh sản xuất › mã lot sản xuất › sản phẩm. Dành cho kho có truy xuất nguồn gốc theo lệnh SX.', 'report', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_basic = EXCLUDED.is_basic;

-- Bật sẵn cho phân hệ Kho Đông Lạnh (đang vận hành thực tế) vì hệ thống đã lưu
-- mảng report_modules riêng nên giá trị mặc định is_basic không tự áp dụng.
-- Các phân hệ khác muốn dùng thì bật trong Cài đặt phân hệ → Tính năng.
UPDATE public.systems
SET report_modules = array_append(report_modules, 'report_inventory_by_production')
WHERE code = 'KHO_DONG_LANH'
  AND NOT ('report_inventory_by_production' = ANY (COALESCE(report_modules, '{}')));
