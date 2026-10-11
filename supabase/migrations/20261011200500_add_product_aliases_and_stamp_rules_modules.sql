-- Migration: Thêm module product_aliases và stamp_rules vào app_modules
INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES
    ('product_aliases', 'Tên gõ tắt', 'Thiết lập danh sách tên viết tắt, từ khóa gõ tắt để tìm kiếm nhanh sản phẩm trên sơ đồ kho và tạo phiếu.', 'product', true),
    ('stamp_rules', 'Cấu hình Dấu Đóng', 'Thiết lập quy tắc, khuôn định dạng và phân tích giải mã ký hiệu dấu đóng mực trên bao bì/thùng hàng.', 'product', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;
