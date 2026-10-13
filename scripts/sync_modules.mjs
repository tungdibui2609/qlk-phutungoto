import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.INTERNAL_SUPABASE_URL || 'http://127.0.0.1:64321';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const MODULE_DEFINITIONS = [
    // Inbound
    { id: 'inbound_basic', name: 'Thông tin cơ bản (Mặc định)', description: 'Mã phiếu, Kho nhập, Ngày tạo, Diễn giải', category: 'inbound', is_basic: true },
    { id: 'inbound_supplier', name: 'Thông tin Nhà cung cấp', description: 'Tên NCC, Địa chỉ, Số điện thoại liên hệ', category: 'inbound', is_basic: true },
    { id: 'inbound_type', name: 'Phân loại phiếu', description: 'Chọn loại phiếu nhập (từ SX, NCC, Chuyển kho...)', category: 'inbound', is_basic: true },
    { id: 'inbound_financials', name: 'Tài chính & Thuế', description: 'Đơn giá, Thành tiền, Chiết khấu, VAT', category: 'inbound', is_basic: false },
    { id: 'inbound_documents', name: 'Chứng từ kèm theo', description: 'Số hóa đơn, Số phiếu giao hàng, Chứng từ gốc', category: 'inbound', is_basic: false },
    { id: 'inbound_logistics', name: 'Vận chuyển & Kho bãi', description: 'Biển số xe, Tên tài xế, Vị trí kho nhập', category: 'inbound', is_basic: false },
    { id: 'inbound_images', name: 'Hình ảnh hóa đơn', description: 'Chụp hoặc tải lên ảnh hóa đơn, chứng từ', category: 'inbound', is_basic: false },
    { id: 'inbound_accounting', name: 'Hạch toán Kế toán', description: 'Tài khoản Nợ/Có, Diễn giải hạch toán', category: 'inbound', is_basic: false },
    { id: 'inbound_ui_compact', name: 'Giao diện thu gọn', description: 'Sử dụng màn hình tạo phiếu nhỏ hơn (Compact Mode)', category: 'inbound', is_basic: false },
    { id: 'inbound_conversion', name: 'Quy đổi đơn vị', description: 'Hiển thị cột quy đổi số lượng theo đơn vị đích (VD: Thùng -> Kg)', category: 'inbound', is_basic: true },
    { id: 'inbound_batch_lot', name: 'Số Lô & Số Batch (NCC)', description: 'Nhập và quản lý Số Lô NCC, Số Batch sản xuất cho từng dòng hàng hóa', category: 'inbound', is_basic: true },
    { id: 'inbound_oem', name: 'Thương hiệu & Khách OEM', description: 'Theo dõi khách hàng OEM, thương hiệu đặt hàng bao bì/vật tư', category: 'inbound', is_basic: true },

    // Outbound
    { id: 'outbound_basic', name: 'Thông tin cơ bản (Mặc định)', description: 'Mã phiếu, Kho xuất, Diễn giải', category: 'outbound', is_basic: true },
    { id: 'outbound_customer', name: 'Thông tin Khách hàng', description: 'Khách hàng, Địa chỉ, Số điện thoại', category: 'outbound', is_basic: true },
    { id: 'outbound_type', name: 'Phân loại phiếu', description: 'Chọn loại phiếu xuất (Xuất bán, Hủy, Chuyển kho...)', category: 'outbound', is_basic: true },
    { id: 'outbound_financials', name: 'Tài chính & Doanh thu', description: 'Đơn giá, Tổng tiền, Chiết khấu thương mại, Thuế', category: 'outbound', is_basic: false },
    { id: 'outbound_images', name: 'Hình ảnh chứng từ', description: 'Chụp hoặc tải lên ảnh phiếu xuất, biên bản', category: 'outbound', is_basic: false },
    { id: 'outbound_logistics', name: 'Giao nhận & Vận chuyển', description: 'Địa điểm giao hàng, Phương thức vận chuyển, Người nhận', category: 'outbound', is_basic: false },
    { id: 'outbound_documents', name: 'Chứng từ xuất kho', description: 'Lệnh xuất kho, Hợp đồng kinh tế', category: 'outbound', is_basic: false },
    { id: 'outbound_accounting', name: 'Hạch toán Kế toán', description: 'Tài khoản Nợ/Có, Doanh thu, Giá vốn', category: 'outbound', is_basic: false },
    { id: 'outbound_ui_compact', name: 'Giao diện thu gọn', description: 'Sử dụng màn hình tạo phiếu nhỏ hơn (Compact Mode)', category: 'outbound', is_basic: false },
    { id: 'outbound_conversion', name: 'Quy đổi đơn vị', description: 'Hiển thị cột quy đổi số lượng theo đơn vị đích (VD: Thùng -> Kg)', category: 'outbound', is_basic: true },
    { id: 'outbound_batch_lot', name: 'Số Lô & Số Batch', description: 'Xuất kho đích danh theo Số Lô hoặc Batch sản xuất', category: 'outbound', is_basic: true },
    { id: 'outbound_oem', name: 'Thương hiệu & Khách OEM', description: 'Xuất hàng phân loại theo khách hàng/thương hiệu OEM', category: 'outbound', is_basic: true },

    // Lot
    { id: 'packaging_date', name: 'Ngày đóng bao bì', description: 'Hiển thị trường nhập và thời gian đóng gói bao bì.', category: 'lot', is_basic: false },
    { id: 'warehouse_name', name: 'Kho nhập hàng', description: 'Hiển thị và cho phép chọn kho nhập hàng (chi nhánh).', category: 'lot', is_basic: true },
    { id: 'peeling_date', name: 'Ngày sản xuất', description: 'Hiển thị trường ngày sản xuất / bóc múi.', category: 'lot', is_basic: false },
    { id: 'batch_code', name: 'Số Batch/Lô (NCC)', description: 'Hiển thị trường nhập số Batch hoặc Lô của nhà cung cấp.', category: 'lot', is_basic: false },
    { id: 'oem_info', name: 'Thương hiệu & Khách OEM', description: 'Hiển thị trường nhập thương hiệu, nhãn hàng hoặc khách hàng OEM của lô hàng.', category: 'lot', is_basic: true },
    { id: 'material_zone', name: 'Vùng nguyên liệu', description: 'Hiển thị trường nhập thông tin vùng nguyên liệu, vùng trồng của lô hàng.', category: 'lot', is_basic: true },
    { id: 'production_place', name: 'Nơi sản xuất', description: 'Hiển thị trường nhập thông tin nơi sản xuất, nhà máy hoặc cơ sở chế biến của lô hàng.', category: 'lot', is_basic: true },
    { id: 'supplier_info', name: 'Nhà cung cấp', description: 'Hiển thị và cho phép chọn nhà cung cấp.', category: 'lot', is_basic: false },
    { id: 'qc_info', name: 'Nhân viên QC', description: 'Hiển thị và cho phép chọn nhân viên kiểm soát chất lượng.', category: 'lot', is_basic: false },
    { id: 'raw_material_date', name: 'Ngày nhập nguyên liệu', description: 'Ghi lại ngày nhập nguyên liệu thô cho lô hàng', category: 'lot', is_basic: false },
    { id: 'inbound_date', name: 'Ngày nhập kho', description: 'Hiển thị trường ngày nhập kho.', category: 'lot', is_basic: true },
    { id: 'lot_images', name: 'Hình ảnh chứng từ / LOT', description: 'Cho phép tải lên và hiển thị hình ảnh của LOT.', category: 'lot', is_basic: false },
    { id: 'extra_info', name: 'Thông tin phụ', description: 'Trường nhập các thông tin bổ sung khác cho LOT.', category: 'lot', is_basic: false },

    // Product
    { id: 'images', name: 'Hình ảnh', description: 'Quản lý hình ảnh đại diện sản phẩm', category: 'product', is_basic: true },
    { id: 'pricing', name: 'Giá cả', description: 'Thiết lập giá vốn, giá bán lẻ, giá bán buôn', category: 'product', is_basic: false },
    { id: 'packaging', name: 'Quy cách đóng gói', description: 'Ghi chú quy cách đóng gói', category: 'product', is_basic: true },
    { id: 'internal_products', name: 'Sản phẩm nội bộ', description: 'Ánh xạ mã và tên sản phẩm gốc sang mã nội bộ dùng cho hệ thống xưởng', category: 'product', is_basic: false },
    { id: 'product_aliases', name: 'Tên gõ tắt', description: 'Thiết lập danh sách tên viết tắt, từ khóa gõ tắt để tìm kiếm nhanh sản phẩm trên sơ đồ kho và tạo phiếu.', category: 'product', is_basic: true },
    { id: 'stamp_rules', name: 'Cấu hình Dấu Đóng', description: 'Thiết lập quy tắc, khuôn định dạng và phân tích giải mã ký hiệu dấu đóng mực trên bao bì/thùng hàng.', category: 'product', is_basic: true },

    // Dashboard
    { id: 'stats_overview', name: 'Thẻ thống kê tổng quan', description: 'Hiển thị tổng sản phẩm, danh mục, tồn kho thấp và nhập hàng trong tuần.', category: 'dashboard', is_basic: true },
    { id: 'inventory_distribution', name: 'Tỉ lệ phân bố hàng hóa', description: 'Biểu đồ tròn hiển thị tỉ lệ phần trăm các loại hàng hóa trong kho.', category: 'dashboard', is_basic: false },
    { id: 'container_distribution', name: 'Ước tính Container xuất bán', description: 'Biểu đồ cột thể hiện ước tính số lượng container tồn kho cho từng sản phẩm theo quy cách thùng.', category: 'dashboard', is_basic: true },
    { id: 'categories_summary', name: 'Danh sách danh mục', description: 'Bảng tóm tắt các danh mục sản phẩm hiện có.', category: 'dashboard', is_basic: false },
    { id: 'recent_products', name: 'Sản phẩm mới nhất', description: 'Danh sách các sản phẩm mới được thêm vào hệ thống.', category: 'dashboard', is_basic: false },

    // Utility & Info
    { id: 'lot_accounting_sync', name: 'Đồng bộ Kho - Kế toán (LOT)', description: 'Tự động tạo hàng chờ nhập/xuất và đồng bộ dữ liệu chênh lệch khi thay đổi LOT.', category: 'utility', is_basic: false },
    { id: 'auto_unbundle_order', name: 'Bẻ gói Kế toán (PNK/PXK)', description: 'Tự động tạo phiếu chuyển đổi (AUTO) khi xuất hàng lẻ đơn vị (ví dụ: bẻ Bao thành Gói).', category: 'utility', is_basic: false },
    { id: 'auto_unbundle_lot', name: 'Bẻ gói Kho (LOT/Vị trí)', description: 'Cho phép thực hiện thao tác chia tách LOT và bẻ đơn vị tính trực tiếp tại sơ đồ kho.', category: 'utility', is_basic: false },
    { id: 'site_inventory_manager', name: 'Cấp phát hàng hóa', description: 'Theo dõi xuất vật tư tiêu hao theo tổ đội và sổ theo dõi mượn/trả công cụ dụng cụ.', category: 'utility', is_basic: false },
    { id: 'production_inventory_manager', name: 'Cấp phát sản xuất', description: 'Theo dõi cấp phát vật tư, linh kiện cho các công đoạn sản xuất và lắp ráp.', category: 'utility', is_basic: false },
    { id: 'utility_qr_assign', name: 'Quét mã QR & Gán vị trí', description: 'Cho phép quét mã QR để gán nhanh vị trí kho. Hiển thị menu Quét mã QR trên thanh điều hướng.', category: 'utility', is_basic: false },
    { id: 'member_team_manager', name: 'Thành viên & Đội', description: 'Quản lý nhân sự và các đội nhóm thi công, vận hành.', category: 'info', is_basic: true },
    { id: 'production_code', name: 'Quản lý Lệnh sản xuất', description: 'Quản lý danh mục lệnh sản xuất, quy trình sản xuất tập trung cho toàn công ty.', category: 'info', is_basic: true },
    { id: 'work_export_order', name: 'Lệnh xuất kho', description: 'Module quản lý các lệnh xuất kho và điều phối hàng hóa.', category: 'utility', is_basic: false },
    { id: 'fifo_priority', name: 'FIFO - Nhập trước Xuất trước', description: 'Ưu tiên hiển thị vị trí/LOT có ngày nhập kho sớm nhất khi tìm kiếm trên Sơ đồ kho và Quản lý LOT.', category: 'utility', is_basic: false },
    { id: 'fresh_material_manager', name: 'Nguyên liệu tươi', description: 'Theo dõi vòng đời nguyên liệu tươi từ bốc xe, phân loại, cấp đông đến thành phẩm.', category: 'utility', is_basic: false },
    { id: 'stock_warning', name: 'Cảnh báo tồn kho', description: 'Tự động gửi email cảnh báo khi sản phẩm xuống dưới ngưỡng tồn tối thiểu.', category: 'utility', is_basic: false },
    { id: 'warehouse_layout_2d', name: 'Sơ đồ kho 2D (AutoCAD)', description: 'Kích hoạt công cụ thiết kế mặt bằng kho 2D, thay thế hoàn toàn cấu trúc sơ đồ phân cấp mặc định.', category: 'utility', is_basic: false },
    { id: 'handover', name: 'Bàn giao hàng hóa', description: 'Quản lý nhận và giao hàng hóa trực tiếp giữa các bộ phận, không cần tạo sản phẩm/đơn vị.', category: 'utility', is_basic: true },
    { id: 'delivery_journal', name: 'Nhật ký giao nhận', description: 'Nhật ký giao nhận giữa Kho và Sản xuất: Kho gửi vật tư, SX nhận và hoàn trả thành phẩm. Đồng bộ real-time.', category: 'utility', is_basic: true },
    { id: 'shift_tasks', name: 'Sổ Giao Việc & Nhắc Nhở Bàn Giao', description: 'Giao việc dở dang, tạo nhắc nhở giao ca kèm hình ảnh minh chứng và xác nhận tiếp nhận 2 bên rõ ràng.', category: 'utility', is_basic: true },
    { id: 'packaging_auto_sync_accounting', name: 'Tự động tạo Phiếu Kế toán (PNK) khi nhập cấp phát', description: 'Khi nhập hàng trực tiếp tại module Cấp phát/Bao bì, tự động tạo Phiếu Nhập Kho Kế toán và LOT mới tương ứng.', category: 'utility', is_basic: true },

    // Print
    { id: 'print_bank_report', name: 'Phiếu ngân hàng', description: 'In báo cáo, biểu mẫu kê khai tồn kho và chứng từ cầm cố/bảo lãnh ngân hàng.', category: 'print', is_basic: true },
    { id: 'bank_inbound', name: 'Nhập ngân hàng', description: 'Quản lý và in ấn chứng từ nhập kho phục vụ thủ tục hồ sơ ngân hàng.', category: 'print', is_basic: true },
    { id: 'bank_outbound', name: 'Xuất ngân hàng', description: 'Quản lý và in ấn chứng từ giải chấp, xuất kho phục vụ thủ tục hồ sơ ngân hàng.', category: 'print', is_basic: true },
    { id: 'print_sequence_number', name: 'In số thứ tự (STT)', description: 'In bảng danh sách và biểu mẫu số thứ tự LOT theo ngày / lô sản xuất.', category: 'print', is_basic: true },

    // QR Scan
    { id: 'qr_pallets', name: 'Quản lý Pallet Quét', description: 'Quản lý, kiểm đếm và theo dõi danh sách Pallet đã quét tem / mã QR theo thời gian thực.', category: 'qr', is_basic: true },
    { id: 'qr_lot_labels', name: 'Liên kết Tem Thùng', description: 'Quét và gán liên kết mã tem thùng / mã thùng hàng với lô hàng LOT.', category: 'qr', is_basic: true },
    { id: 'qr_lot_labels_mobile', name: 'Liên kết Tem (Mobile)', description: 'Giao diện di động thao tác nhanh quét liên kết tem thùng trực tiếp tại xưởng.', category: 'qr', is_basic: true },
    { id: 'qr_stamp_lookup', name: 'Tra cứu tem', description: 'Công cụ tra cứu thông tin chi tiết nguồn gốc và trạng thái của mã tem thùng, dấu đóng.', category: 'qr', is_basic: true },
    { id: 'utility_qr_assign', name: 'Gán vị trí (Quét QR)', description: 'Quét mã QR để gán nhanh vị trí kho cho Pallet và sản phẩm.', category: 'qr', is_basic: true },
    { id: 'qr_export', name: 'Xuất kho (Quét QR)', description: 'Thao tác quét mã QR thùng/pallet để thực hiện thủ tục xuất kho chính xác.', category: 'qr', is_basic: true },
    { id: 'qr_export_order', name: 'Lệnh xuất (Quét QR)', description: 'Quét mã kiểm tra và xuất kho theo lệnh điều động xuất hàng.', category: 'qr', is_basic: true },
    { id: 'qr_print_station', name: 'Máy in trạm', description: 'Quản lý máy in trạm tại các chốt kiểm soát quét mã và in tem nhãn.', category: 'qr', is_basic: true },
    { id: 'qr_mobile_access', name: 'Mobile (Quét QR)', description: 'Trung tâm điều hướng giao diện quét mã QR trên thiết bị di động / máy quét cầm tay.', category: 'qr', is_basic: true },
    { id: 'qr_production_lot', name: 'LOT Sản Xuất', description: 'Quét kiểm tra và theo dõi tiến độ LOT thành phẩm trong dây chuyền sản xuất.', category: 'qr', is_basic: true },

    // Reports
    { id: 'report_hall_summary', name: 'Thống kê sảnh', description: 'Báo cáo tổng hợp số lượng, trạng thái hàng hóa và vị trí tại các khu vực sảnh.', category: 'report', is_basic: true },
    { id: 'report_floor_1', name: 'Báo cáo tầng 1', description: 'Báo cáo chi tiết hoạt động xuất nhập và tồn kho tại khu vực tầng 1.', category: 'report', is_basic: true },
    { id: 'report_warehouse_map_log', name: 'Nhật ký sơ đồ kho', description: 'Theo dõi lịch sử thay đổi vị trí, sơ đồ mặt bằng và cấu trúc kho.', category: 'report', is_basic: true },
    { id: 'report_warehouse_movements', name: 'Diễn biến kho (Sạch)', description: 'Thống kê luồng luân chuyển hàng hóa sạch và diễn biến xuất nhập tồn.', category: 'report', is_basic: true },
    { id: 'report_picking_productivity', name: 'Năng suất lấy hàng', description: 'Báo cáo hiệu suất, tốc độ lấy hàng và năng suất làm việc của nhân sự.', category: 'report', is_basic: true }
];

async function sync() {
    console.log('Fetching current app_modules from DB...');
    const { data: existing, error } = await supabase.from('app_modules').select('*');
    if (error) {
        console.error('Error fetching existing:', error);
        return;
    }

    const existingMap = new Map((existing || []).map(m => [m.id, m]));
    console.log(`Currently ${existingMap.size} modules in DB.`);

    let inserted = 0;
    let updated = 0;

    for (const mod of MODULE_DEFINITIONS) {
        const current = existingMap.get(mod.id);
        if (!current) {
            // New module: ALWAYS default is_basic = true as per user rule!
            console.log(`[NEW] Inserting ${mod.id} (${mod.name}) with is_basic: true`);
            const { error: insErr } = await supabase.from('app_modules').insert({
                id: mod.id,
                name: mod.name,
                description: mod.description,
                category: mod.category,
                is_basic: true // Mặc định là cơ bản khi mới tạo
            });
            if (insErr) console.error(`Error inserting ${mod.id}:`, insErr);
            else inserted++;
        } else {
            // Update name and description if different, but preserve existing is_basic
            const needsUpdate = current.name !== mod.name || current.description !== mod.description || current.category !== mod.category;
            if (needsUpdate) {
                console.log(`[UPDATE] Updating text for ${mod.id}`);
                const { error: updErr } = await supabase.from('app_modules').update({
                    name: mod.name,
                    description: mod.description,
                    category: mod.category
                }).eq('id', mod.id);
                if (updErr) console.error(`Error updating ${mod.id}:`, updErr);
                else updated++;
            }
        }
    }

    console.log(`Sync completed: ${inserted} inserted, ${updated} updated.`);
}

sync();
