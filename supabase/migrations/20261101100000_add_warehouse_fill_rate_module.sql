-- Đăng ký module "Tỉ lệ lấp đầy kho" vào danh mục module trung tâm.
-- Module bật/tắt theo phân hệ kho (Cài đặt phân hệ → Tính năng → Dashboard),
-- không hardcode mã kho: kho nào bật thì khối "Tỉ lệ lấp đầy" tự hiện trên trang Dashboard.
INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES
    ('warehouse_fill_rate', 'Tỉ lệ lấp đầy kho', 'Khối thống kê tỉ lệ lấp đầy ô vị trí theo khu vực, tách thành tab Lô kệ / Sảnh tạm kết / Tổng, kèm cảnh báo khu sắp đầy.', 'dashboard', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_basic = EXCLUDED.is_basic;

-- Với phân hệ đã lưu danh sách dashboard_modules tường minh (đang có module khác bật),
-- is_basic không tự áp dụng nên phải thêm module vào mảng.
-- Không đụng tới phân hệ có mảng rỗng (người dùng cố tắt hết Dashboard) hoặc NULL
-- (NULL đã tự lấy danh sách module Cơ bản, trong đó có module này).
UPDATE public.systems
SET dashboard_modules = array_append(dashboard_modules, 'warehouse_fill_rate')
WHERE dashboard_modules IS NOT NULL
  AND array_length(dashboard_modules, 1) > 0
  AND NOT ('warehouse_fill_rate' = ANY (dashboard_modules));
