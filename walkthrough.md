# Walkthrough: Mở Mặc Định & Cấu Hình Phân Quyền Nhật Ký Giao Nhận

Tài liệu này mô tả các thay đổi kỹ thuật nhằm giải quyết vấn đề tài khoản nhân viên không truy cập được trang **Nhật ký giao nhận** (`/delivery-journal`) và **Ca làm & Thống kê** (`/delivery-shifts`), đồng thời nâng cấp hệ thống phân quyền để quản trị viên có thể tùy biến chặn trang linh hoạt.

## 1. Vấn đề (Problem)
- **Thiếu định nghĩa Quyền**: Trong cơ sở dữ liệu (bảng `permissions`), hai quyền `delivery_journal.view` và `delivery_journal.manage` chưa được khai báo. Do đó, quản trị viên không thể gán quyền này cho bất kỳ nhân viên nào trong giao diện phân quyền.
- **Ràng buộc quá chặt chẽ**: Menu "Nhật ký giao nhận kho" và "Ca làm & Thống kê" yêu cầu quyền `delivery_journal.view`, khiến nhân viên mặc định bị ẩn menu và không thể truy cập, trong khi nhu cầu thực tế là **tất cả nhân viên đều nên vào được mặc định** để ghi nhận dữ liệu giao nhận.
- **Thiếu kiểm soát chặn trang**: Các trang giao nhận chưa được cấu hình trong `APP_ROUTES` của Client, làm cho Admin không thể cấu hình chặn truy cập các trang này khi cần thiết.

## 2. Giải pháp (Solution)

### A. Mở mặc định truy cập (Default Access)
Để giải quyết yêu cầu *"tốt nhất là tài khoản nào cũng vào được"* của khách hàng, chúng tôi đã loại bỏ ràng buộc `requiredPermission` đối với menu Nhật ký giao nhận và Thống kê ca trong hệ thống:
- **File sửa đổi**: [Sidebar.tsx](file:///d:/chanh%20thu/web/src/components/layout/Sidebar.tsx)
- **Chi tiết**: Loại bỏ thuộc tính `requiredPermission: 'delivery_journal.view'` khỏi menu `delivery_journal_kho` và `delivery_shifts_kho`.
- **Kết quả**: Tất cả tài khoản nhân viên khi đăng nhập vào phân hệ kho có kích hoạt module `delivery_journal` đều sẽ nhìn thấy và truy cập được hai trang này một cách mặc định.

### B. Tích hợp Quản lý Chặn Trang (Blocked Pages Management)
Để Admin vẫn giữ được quyền kiểm soát tối cao (có thể chặn một số nhân viên cụ thể không được vào các trang này):
- **File sửa đổi**: [routes.ts](file:///d:/chanh%20thu/web/src/config/routes.ts)
- **Chi tiết**: Đã khai báo nhóm route `Giao nhận` vào danh sách `APP_ROUTES`:
  ```typescript
  {
      name: 'Giao nhận',
      path: '/delivery-management',
      children: [
          { name: 'Cài đặt giao nhận', path: '/delivery-settings' },
          { name: 'Nhật ký giao nhận kho', path: '/delivery-journal' },
          { name: 'Ca làm & Thống kê', path: '/delivery-shifts' },
      ]
  }
  ```
- **Kết quả**: Admin sẽ nhìn thấy các trang này xuất hiện trong tab **"Chặn Trang (Blocked Pages)"** tại màn hình Phân quyền người dùng. Admin có thể tích chọn để chặn một nhân viên bất kỳ không cho truy cập trang giao nhận.

### C. Đồng bộ hiển thị Phân quyền & Khai báo Database
Để hệ thống chuẩn chỉ và sẵn sàng cho việc phân quyền chi tiết:
- **File sửa đổi**: [page.tsx](file:///d:/chanh%20thu/web/src/app/%28dashboard%29/users/permissions/page.tsx)
- **Chi tiết**: Thêm nhãn dịch `"Giao nhận"` cho mã module `delivery_journal` trong `featureNames` để hiển thị trực quan trong bảng phân quyền.
- **Migration SQL**: Tạo file [20260518000000_add_delivery_journal_permissions.sql](file:///d:/chanh%20thu/web/supabase/migrations/20260518000000_add_delivery_journal_permissions.sql) để chèn hai quyền này vào bảng `permissions` của cơ sở dữ liệu:
  ```sql
  INSERT INTO public.permissions (code, name, module, description)
  VALUES 
      ('delivery_journal.view', 'Xem nhật ký giao nhận', 'Giao nhận', 'Cho phép xem nhật ký giao nhận và ca làm việc'),
      ('delivery_journal.manage', 'Quản lý giao nhận', 'Giao nhận', 'Cho phép cấu hình cài đặt giao nhận và ca làm việc')
  ON CONFLICT (code) DO NOTHING;
  ```

## 3. Tuân thủ kiến trúc "System-Aware" & Cô lập dữ liệu (AGENTS.md)
- **Kiến trúc Modular**: Các trang giao nhận được bảo vệ ở mức phân hệ thông qua thuộc tính `requiredModule: 'delivery_journal'` trong Sidebar. Chỉ những phân hệ kho nào được đăng ký và kích hoạt module này mới hiển thị menu.
- **Cô lập dữ liệu**: Logic xử lý bên trong các trang `/delivery-journal` và `/delivery-shifts` đã tích hợp bộ lọc `system_code` chặt chẽ từ trước. Khi nhân viên truy cập, họ chỉ nhìn thấy dữ liệu giao nhận thuộc phân hệ kho hiện hành mà họ đang làm việc, tuyệt đối không bị rò rỉ dữ liệu sang các phân hệ kho khác.

---
*Người thực hiện: Antigravity Agent*
