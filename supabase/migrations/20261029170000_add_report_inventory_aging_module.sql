-- Đăng ký module báo cáo "Tồn kho lâu ngày" (aging) vào danh mục module trung tâm
INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES
    ('report_inventory_aging', 'Tồn kho lâu ngày', 'Báo cáo tuổi tồn kho theo ngưỡng tuỳ chỉnh (90/180 ngày), chọn mốc ngày nhập kho, sản xuất, nguyên liệu hoặc đóng gói', 'report', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;
