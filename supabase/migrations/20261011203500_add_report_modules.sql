-- Add report_modules column to systems
ALTER TABLE public.systems ADD COLUMN IF NOT EXISTS report_modules text[] DEFAULT ARRAY[]::text[];

-- Notify postgrest to reload schema
NOTIFY pgrst, 'reload schema';

-- Insert/Upsert report modules into app_modules
INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES
    ('report_hall_summary', 'Thống kê sảnh', 'Báo cáo tổng hợp số lượng, trạng thái hàng hóa và vị trí tại các khu vực sảnh', 'report', true),
    ('report_floor_1', 'Báo cáo tầng 1', 'Báo cáo chi tiết hoạt động xuất nhập và tồn kho tại khu vực tầng 1', 'report', true),
    ('report_warehouse_map_log', 'Nhật ký sơ đồ kho', 'Theo dõi lịch sử thay đổi vị trí, sơ đồ mặt bằng và cấu trúc kho', 'report', true),
    ('report_warehouse_movements', 'Diễn biến kho (Sạch)', 'Thống kê luồng luân chuyển hàng hóa sạch và diễn biến xuất nhập tồn', 'report', true),
    ('report_picking_productivity', 'Năng suất lấy hàng', 'Báo cáo hiệu suất, tốc độ lấy hàng và năng suất làm việc của nhân sự', 'report', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_basic = EXCLUDED.is_basic;
