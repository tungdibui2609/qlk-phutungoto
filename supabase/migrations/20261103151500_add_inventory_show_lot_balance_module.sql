-- Đăng ký module "Hiện Tồn kho theo LOT (Bảng Kế toán)" vào danh mục module trung tâm.
-- Module này bật/tắt theo phân hệ kho (Cài đặt phân hệ → Tính năng → Báo cáo),
-- không hardcode mã kho: kho nào bật thì cột Tồn kho theo LOT trên bảng Kế toán tự hiện.
INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES
    ('inventory_show_lot_balance', 'Hiện Tồn kho theo LOT (Bảng Kế toán)', 'Hiển thị thêm cột số lượng Tồn kho theo LOT ngay trên bảng Tồn kho kế toán để dễ dàng đối chiếu số lượng thực tế trong kho với sổ sách.', 'report', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_basic = EXCLUDED.is_basic;

-- Kích hoạt cho phân hệ Kho Đông Lạnh để người dùng kiểm tra ngay
UPDATE public.systems
SET report_modules = array_append(report_modules, 'inventory_show_lot_balance')
WHERE code = 'KHO_DONG_LANH'
  AND NOT ('inventory_show_lot_balance' = ANY (COALESCE(report_modules, '{}')));

