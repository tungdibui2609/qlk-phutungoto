-- Đăng ký module "Đối chiếu kiểm kê" vào danh mục module trung tâm.
-- Module này bật/tắt theo phân hệ kho (Cài đặt phân hệ → Tính năng → Báo cáo),
-- không hardcode mã kho: kho nào bật thì menu "Đối chiếu kiểm kê" tự hiện.
INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES
    ('report_stocktake_diff', 'Đối chiếu kiểm kê', 'So 2 file Excel cùng loại (sơ đồ kho dạng Bảng / dạng Lưới, hoặc tồn kho theo LOT) xuất trước và sau khi kiểm kê để chỉ ra chỗ lệch số lượng, xuất báo cáo Excel tô đỏ dòng lệch', 'report', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_basic = EXCLUDED.is_basic;

-- Bật sẵn cho phân hệ Kho Đông Lạnh (đang vận hành thực tế) vì hệ thống đã lưu
-- mảng report_modules riêng nên giá trị mặc định is_basic không tự áp dụng.
-- Các phân hệ khác muốn dùng thì bật trong Cài đặt phân hệ → Tính năng.
UPDATE public.systems
SET report_modules = array_append(report_modules, 'report_stocktake_diff')
WHERE code = 'KHO_DONG_LANH'
  AND NOT ('report_stocktake_diff' = ANY (COALESCE(report_modules, '{}')));
