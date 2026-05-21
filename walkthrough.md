# Walkthrough: Chi Tiết Hóa Chốt Ca Tạm & Đối Soát Ca Làm Việc

Tài liệu này mô tả các thay đổi kỹ thuật và cải tiến giao diện người dùng nhằm nâng cấp toàn diện tính năng **Chốt ca tạm (đổi ca)** và **Chốt ca đối soát (cuối ca)** tại trang Nhật trình giao nhận (`/delivery-journal`) và Lịch sử ca làm việc (`/delivery-shifts`).

---

## 🎯 1. Mục Tiêu & Yêu Cầu Đã Đạt Được
1. **Lưu trữ dữ liệu chi tiết (`summary_data`):** Cả ca tạm và ca đối soát đều lưu cấu trúc dữ liệu chi tiết gồm:
   - Tổng quan 2 hướng (`w2p` - Cấp vật tư, `p2w` - Nhập thành phẩm).
   - Chi tiết gom nhóm theo Đơn vị tính (`units_summary`).
   - Đối soát chi tiết theo Lệnh sản xuất MO (`mo_summary` phân rã theo `from_department` và lấy được `mo_name` chính xác từ database `productions`).
2. **Bố cục giao diện Lịch sử ca (`/delivery-shifts`):**
   - Đưa Accordion Timeline các lần chốt ca tạm lên trên cùng (ngay dưới Header ca).
   - Bấm vào từng ca tạm sẽ bung mở chi tiết đối soát đầy đủ (2 hướng, ĐVT, Lệnh sản xuất) của riêng ca tạm đó.
   - Đưa phần Tổng hợp số liệu đối soát cả ca (Sum tổng) và Ghi chú bàn giao xuống phía dưới các ca tạm.
   - **Mới:** Phần **Tổng hợp đối soát cả ca (Sum tổng)** cũng được cải tiến dưới dạng **Accordion đóng/mở (Collapse/Expand)**, giúp giao diện trở nên gọn gàng, thanh lịch và giảm thiểu cuộn trang khi không cần thiết.
   - **Mặc định đóng:** Khi người dùng mở xem ca làm việc, phần Sum tổng đối soát cả ca sẽ **mặc định hiển thị ở trạng thái đóng (collapsed)** để giao diện ban đầu luôn gọn gàng và tinh tế nhất. Người dùng chỉ cần click vào tiêu đề để mở rộng xem chi tiết.
   - Đồng bộ 100% giao diện bằng cách sử dụng chung hàm render chi tiết `renderDetailedReconciliation`.
3. **Độ tương thích ngược hoàn hảo:** 
   - Hàm `getShiftSummaryData()` tự động nhận diện nếu `summary_data` trong database đã nâng cấp (có chứa `w2p`) thì dùng trực tiếp để hiển thị tức thì.
   - Đối với các ca cũ (chưa nâng cấp database), hàm sẽ tự động build động từ danh sách `shiftJournals` đã tải. Điều này giúp hệ thống hiển thị mượt mà tức thì cho các ca mới mà không cần load journals từ database, đồng thời vẫn giữ được khả năng hiển thị hoàn hảo cho dữ liệu lịch sử cũ.

---

## 🏗️ 2. Chi Tiết Các Thay Đổi Kỹ Thuật

### A. Đồng bộ cấu trúc Backend & Database (`summary_data`)
- **File sửa đổi:** [delivery-journal/page.tsx](file:///d:/chanh%20thu/web/src/app/%28dashboard%29/delivery-journal/page.tsx)
- **Nâng cấp logic:**
  - Nâng cấp hàm `calculateInterimSummary` (chốt ca tạm) và hàm `calculateShiftSummary` (chốt đối soát ca) để tự động query thông tin Lệnh sản xuất từ bảng `productions` thông qua `settingsData` để lưu trữ tên lệnh sản xuất (`mo_name`) trực tiếp vào JSON.
  - Phân rã dữ liệu giao nhận thành hai hướng rõ rệt: `w2p` (Kho → Sản xuất) và `p2w` (Sản xuất → Kho).

### B. Thiết kế lại giao diện Master-Detail & Accordion Timeline
- **File sửa đổi:** [delivery-shifts/page.tsx](file:///d:/chanh%20thu/web/src/app/%28dashboard%29/delivery-shifts/page.tsx)
- **Tái cấu trúc UI:**
  - **Hàm render dùng chung `renderDetailedReconciliation(summaryData)`:** Được phát triển để hiển thị giao diện đối soát cực kỳ cao cấp, sử dụng HSL color palette sang trọng:
    - *Màu xanh dương (blue):* Cho hướng Cấp vật tư (`w2p`).
    - *Màu tím (purple):* Cho hướng Nhập thành phẩm (`p2w`).
    - *Màu lục (emerald):* Cho các đợt nhận thành công.
    - *Màu đỏ (rose):* Cho các đợt bị từ chối/hủy.
    - *Màu chàm (indigo):* Cho gom nhóm theo Lệnh sản xuất.
  - **Accordion ca tạm (Timeline):** Được đưa lên vị trí trang trọng nhất (dưới Header thông tin ca). Mỗi lần chốt ca tạm được hiển thị thành một Node Timeline tròn màu hổ phách (`amber`). Khi người dùng click vào, Accordion sẽ nhẹ nhàng trượt mở rộng (`animate-slideDown`) hiển thị toàn bộ chi tiết đối soát của riêng ca tạm đó.
  - **Accordion Sum tổng cả ca:** Sử dụng state `isMainSummaryExpanded` để điều khiển đóng/mở, mặc định khởi tạo là `false`. Khi hover, có micro-animation scale nhẹ icon và đổi màu chữ sang cam nhằm tăng độ thu hút tương tác.

---

## 🔒 3. Bảo Mật & Cô Lập Dữ Liệu Theo Phân Hệ (RULE[AGENTS.md])

Hệ thống tuân thủ nghiêm ngặt nguyên tắc **"System-Aware Planning"**:
1. **Lọc dữ liệu ca tạm:** Truy vấn `delivery_sub_shifts` lọc chính xác theo:
   ```typescript
   .eq('shift_id', selectedShift.id)
   .eq('system_code', currentSystem.code)
   ```
2. **Lọc dữ liệu ca làm việc:** Truy vấn `delivery_shifts` lọc chính xác theo:
   ```typescript
   .eq('company_id', companyId)
   .eq('system_code', currentSystem?.code)
   ```
3. **Cô lập logic:** Mọi thao tác ghi nhận dữ liệu mới trong `/delivery-journal` khi chốt ca tạm/ca làm việc đều tự động truyền thuộc tính `system_code: currentSystem.code` từ Context.

---
*Người thực hiện: Antigravity Agent - Google DeepMind*
