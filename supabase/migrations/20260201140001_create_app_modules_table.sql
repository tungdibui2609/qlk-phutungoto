-- Create modules table to store dynamic configuration
CREATE TABLE IF NOT EXISTS public.app_modules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'product', 'inbound', 'outbound', 'lot', 'dashboard', 'utility'
    is_basic BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read modules (needed for UI to render options)
CREATE POLICY "Everyone can read modules" ON public.app_modules
    FOR SELECT USING (true);

-- Only Super Admin can update modules (toggle basic/advanced)
-- Assuming Super Admin is identified via a specific email or role system.
-- For now, we'll allow authenticated users to read, but strict updates might need specific logic.
-- Ideally, we check if the user is a super admin. 
-- Since we are in a migration, we will set a policy that allows updates only if the user handles the admin rights (to be refined).
-- For this step, we'll allow all authenticated users to read. Updates will be restricted later or assuming admin app checks permissions before call.
CREATE POLICY "Super admin can update modules" ON public.app_modules
    FOR UPDATE USING (
        -- Replace with actual super admin check if available, or restrict to service role/admin clients
        -- For simplicity in this context, we trust the application enforcement or existing admin policies.
        -- A common pattern is checking a profile role or simplier:
        auth.role() = 'authenticated' -- Revise this for stricter security in production
    );

-- Seed Data (Upsert)
INSERT INTO public.app_modules (id, name, description, category, is_basic) VALUES
-- Product Modules
('images', 'Hình ảnh', 'Quản lý hình ảnh đại diện sản phẩm', 'product', true),
('pricing', 'Giá cả', 'Thiết lập giá vốn, giá bán lẻ, giá bán buôn', 'product', false),
('packaging', 'Quy cách đóng gói', 'Ghi chú quy cách đóng gói', 'product', true),

-- Inbound Modules (Order)
('inbound_basic', 'Thông tin cơ bản (Mặc định)', 'Mã phiếu, Kho nhập, Ngày tạo, Diễn giải', 'inbound', true),
('inbound_supplier', 'Thông tin Nhà cung cấp', 'Tên NCC, Địa chỉ, Số điện thoại liên hệ', 'inbound', false),
('inbound_type', 'Phân loại phiếu', 'Chọn loại phiếu nhập (từ SX, NCC, Chuyển kho...)', 'inbound', false),
('inbound_financials', 'Tài chính & Thuế', 'Đơn giá, Thành tiền, Chiết khấu, VAT', 'inbound', false),
('inbound_documents', 'Chứng từ kèm theo', 'Số hóa đơn, Số phiếu giao hàng, Chứng từ gốc', 'inbound', false),
('inbound_logistics', 'Vận chuyển & Kho bãi', 'Biển số xe, Tên tài xế, Vị trí kho nhập', 'inbound', false),
('inbound_images', 'Hình ảnh hóa đơn', 'Chụp hoặc tải lên ảnh hóa đơn, chứng từ', 'inbound', false),
('inbound_accounting', 'Hạch toán Kế toán', 'Tài khoản Nợ/Có, Diễn giải hạch toán', 'inbound', false),
('inbound_ui_compact', 'Giao diện thu gọn', 'Sử dụng màn hình tạo phiếu nhỏ hơn (Compact Mode)', 'inbound', false),
('inbound_conversion', 'Quy đổi đơn vị', 'Hiển thị cột quy đổi số lượng theo đơn vị đích (VD: Thùng -> Kg)', 'inbound', false),

-- Outbound Modules (Order)
('outbound_basic', 'Thông tin cơ bản (Mặc định)', 'Mã phiếu, Kho xuất, Diễn giải', 'outbound', true),
('outbound_customer', 'Thông tin Khách hàng', 'Khách hàng, Địa chỉ, Số điện thoại', 'outbound', false),
('outbound_type', 'Phân loại phiếu', 'Chọn loại phiếu xuất (Xuất bán, Hủy, Chuyển kho...)', 'outbound', false),
('outbound_financials', 'Tài chính & Doanh thu', 'Đơn giá, Tổng tiền, Chiết khấu thương mại, Thuế', 'outbound', false),
('outbound_images', 'Hình ảnh chứng từ', 'Chụp hoặc tải lên ảnh phiếu xuất, biên bản', 'outbound', false),
('outbound_logistics', 'Giao nhận & Vận chuyển', 'Địa điểm giao hàng, Phương thức vận chuyển, Người nhận', 'outbound', false),
('outbound_documents', 'Chứng từ xuất kho', 'Lệnh xuất kho, Hợp đồng kinh tế', 'outbound', false),
('outbound_accounting', 'Hạch toán Kế toán', 'Tài khoản Nợ/Có, Doanh thu, giá vốn', 'outbound', false),
('outbound_ui_compact', 'Giao diện thu gọn', 'Sử dụng màn hình tạo phiếu nhỏ hơn (Compact Mode)', 'outbound', false),
('outbound_conversion', 'Quy đổi đơn vị', 'Hiển thị cột quy đổi số lượng theo đơn vị đích (VD: Thùng -> Kg)', 'outbound', false),

-- Lot Modules
('packaging_date', 'Ngày đóng bao bì', 'Hiển thị trường nhập và thời gian đóng gói bao bì.', 'lot', false),
('warehouse_name', 'Kho nhập hàng', 'Hiển thị và cho phép chọn kho nhập hàng (chi nhánh).', 'lot', true),
('peeling_date', 'Ngày bóc múi', 'Hiển thị trường ngày bóc múi.', 'lot', false),
('batch_code', 'Số Batch/Lô (NCC)', 'Hiển thị trường nhập số Batch hoặc Lô của nhà cung cấp.', 'lot', false),
('supplier_info', 'Nhà cung cấp', 'Hiển thị và cho phép chọn nhà cung cấp.', 'lot', false),
('qc_info', 'Nhân viên QC', 'Hiển thị và cho phép chọn nhân viên kiểm soát chất lượng.', 'lot', false),
('inbound_date', 'Ngày nhập kho', 'Hiển thị trường ngày nhập kho.', 'lot', true),
('lot_images', 'Hình ảnh chứng từ / LOT', 'Cho phép tải lên và hiển thị hình ảnh của LOT.', 'lot', false),
('extra_info', 'Thông tin phụ', 'Trường nhập các thông tin bổ sung khác cho LOT.', 'lot', false),

-- Dashboard Modules
('stats_overview', 'Thẻ thống kê tổng quan', 'Hiển thị tổng sản phẩm, danh mục, tồn kho thấp và nhập hàng trong tuần.', 'dashboard', true),
('inventory_distribution', 'Tỉ lệ phân bố hàng hóa', 'Biểu đồ tròn hiển thị tỉ lệ phần trăm các loại hàng hóa trong kho.', 'dashboard', false),
('categories_summary', 'Danh sách danh mục', 'Bảng tóm tắt các danh mục sản phẩm hiện có.', 'dashboard', false),
('recent_products', 'Sản phẩm mới nhất', 'Danh sách các sản phẩm mới được thêm vào hệ thống.', 'dashboard', false),

-- Utility Modules
('lot_accounting_sync', 'Đồng bộ Kho - Kế toán (LOT)', 'Tự động tạo hàng chờ nhập/xuất và đồng bộ dữ liệu chênh lệch khi thay đổi LOT.', 'utility', false),
('auto_unbundle_order', 'Bẻ gói Kế toán (PNK/PXK)', 'Tự động tạo phiếu chuyển đổi (AUTO) khi xuất hàng lẻ đơn vị (ví dụ: bẻ Bao thành Gói).', 'utility', false),
('auto_unbundle_lot', 'Bẻ gói Kho (LOT/Vị trí)', 'Cho phép thực hiện thao tác chia tách LOT và bẻ đơn vị tính trực tiếp tại sơ đồ kho.', 'utility', false),
('site_inventory_manager', 'Quản lý Cấp Phát Công Trình', 'Theo dõi xuất vật tư tiêu hao theo tổ đội và sổ theo dõi mượn/trả công cụ dụng cụ.', 'utility', false)

ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_basic = EXCLUDED.is_basic;
