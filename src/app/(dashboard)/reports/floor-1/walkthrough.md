# Walkthrough: Báo cáo Tầng 1

Tính năng này cung cấp một cái nhìn tổng quan về tình trạng tồn kho tại tầng 1 (tầng thấp nhất) của tất cả các kho trong hệ thống.

## 🌟 Tính năng chính
- **Thống kê tầng 1**: Tự động lọc tất cả các vị trí có mã định danh tầng là 1 (dựa trên format `T1xx`).
- **Giao diện sơ đồ (Grid-view)**: Hiển thị các ô vị trí tương tự sơ đồ kho nhưng tập trung vào thông tin hàng hóa.
- **Thông tin chi tiết trong ô**:
    - Tên sản phẩm (hỗ trợ hiển thị nhiều sản phẩm nếu lot có nhiều item).
    - Số lượng và Đơn vị tính.
    - Mã SKU.
    - Số thứ tự (STT) của lô (Lot Code).
- **Bộ lọc thông minh**:
    - Lọc theo từng kho cụ thể.
    - Tìm kiếm theo SKU, tên sản phẩm hoặc mã vị trí.
- **Hỗ trợ In ấn**: Giao diện được tối ưu hóa để in báo cáo trực tiếp từ trình duyệt.

## 🏗 Kiến trúc & Bảo mật (System-Aware)
Tính năng này được xây dựng tuân thủ nghiêm ngặt kiến trúc đa phân hệ của dự án:
- **Cô lập dữ liệu**: Sử dụng `system_type` và `system_code` để đảm bảo báo cáo chỉ hiển thị dữ liệu của phân hệ kho hiện hành mà người dùng đang làm việc.
- **Hiệu năng**: Fetch dữ liệu theo từng block (chunks) và sử dụng `useMemo` để tối ưu hóa việc lọc và hiển thị hàng ngàn vị trí mà không gây lag UI.
- **Phân quyền**: Yêu cầu quyền `report.view` để truy cập.

## 📂 Các file đã thay đổi/tạo mới
1. `src/components/layout/Sidebar.tsx`: Thêm menu "Báo cáo tầng 1".
2. `src/app/(dashboard)/reports/floor-1/page.tsx`: File logic và giao diện chính của báo cáo.

---
*Ghi chú: Tầng 1 được xác định tự động thông qua regex `match(/T(\d)/i)` từ mã vị trí (Position Code).*
