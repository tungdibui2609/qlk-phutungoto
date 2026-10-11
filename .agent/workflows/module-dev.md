---
description: Workflow phát triển và cấu hình Module (Cơ bản vs Nâng cao)
---

Bất cứ khi nào người dùng yêu cầu thêm tính năng mới hoặc thay đổi cấu hình module, bạn PHẢI thực hiện các bước sau:

1. **Quy tắc Phân loại (BẮT BUỘC)**:
   - **Tất cả các module mới tạo MẶC ĐỊNH LUÔN LÀ CƠ BẢN (`is_basic: true`)**.
   - Admin sẽ chủ động chuyển đổi sang Nâng cao (Advanced) sau trên giao diện quản trị `http://localhost:3000/admin/modules` nếu cần.
2. **Khai báo Module trong Code**:
   - Khai báo trong các file tương ứng:
     - `src/lib/order-modules.ts` (Nhập kho / Xuất kho)
     - `src/lib/lot-modules.ts` (Quản lý LOT)
     - `src/lib/product-modules.ts` (Sản phẩm)
     - `src/lib/dashboard-modules.ts` (Dashboard)
     - `src/lib/utility-modules.ts` (Tiện ích hệ thống / Thông tin)
   - Đảm bảo thiết lập `is_basic: true` trong định nghĩa module.
3. **Đồng bộ vào Cơ sở Dữ liệu (`app_modules`)**:
   - Chạy hàm `syncAppModulesWithCode()` trong `src/lib/module-sync.ts` hoặc script `node scripts/sync_modules.mjs` để upsert module mới vào bảng `app_modules` với `is_basic = true`.
   - Trang `http://localhost:3000/admin/modules` cũng đã có cơ chế tự động đồng bộ khi tải trang và nút bấm "Đồng bộ từ Code".
4. **Triển khai Giao diện (UI)**: PHẢI sử dụng các thành phần dùng chung sau để đảm bảo tốc độ và tính đồng bộ:
   - **`useListingData`**: Dùng hook này để fetch và filter dữ liệu. KHÔNG viết lại `useEffect`/`useState` cho danh sách.
   - **`PageHeader`**: Dùng cho tiêu đề trang và nút Action.
   - **`StatusBadge`**: Dùng cho cột trạng thái Hoạt động/Ngừng.
   - **`EmptyState`**: Dùng khi không có dữ liệu.
5. **Kiểm tra**:
   - Trang quản lý module hệ thống: `http://localhost:3000/admin/modules` (kiểm tra trạng thái Cơ bản/Nâng cao).
   - Trang cấu hình công ty: `http://localhost:3000/admin/companies/[id]/modules` (kiểm tra hiển thị và bật/tắt cho từng kho).
