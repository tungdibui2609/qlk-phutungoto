# Định hướng Phát triển & Kiến trúc Dự án (Core Guidelines)

Tài liệu này quy định các nguyên tắc cốt lõi khi phát triển tính năng mới để đảm bảo tính nhất quán của hệ thống đa người dùng (Multi-tenant).

## 1. Phân hệ Công ty (Multi-tenant)
Hệ thống được thiết kế để phục vụ nhiều công ty (Tenant) trên cùng một cơ sở hạ tầng.

- **Nguyên tắc vàng**: Mọi dữ liệu (ngoại trừ danh mục hệ thống dùng chung) **PHẢI** được gắn với `company_id`.
- **Cô lập dữ liệu**: Không bao giờ được phép để lộ dữ liệu của công ty này cho công ty khác. Sử dụng RLS (Row Level Security) của Supabase là lớp bảo vệ cuối cùng.
- **Tài khoản Admin**: Mỗi công ty có ít nhất một tài khoản `Company Admin` (Account Level 2), có quyền quản lý kho, nhân viên và cấu hình trong phạm vi công ty đó.

## 2. Phân loại & Phân hệ Kho (Systems)
Một công ty có thể có nhiều loại kho (phân hệ) khác nhau trên cùng một nền tảng.

- **Định nghĩa**: Một "Kho" (System) trong code thường được gọi là `System`.
- **Cấu hình độc lập**: Mỗi System có danh sách module riêng (Inbound, Outbound, Lot, Dashboard).
- **Phân tách nghiệp vụ**: Tránh viết code logic chung cho tất cả các kho nếu nghiệp vụ đó chỉ đặc thù cho một loại kho. Hãy sử dụng hệ thống Module để bật/tắt logic.

## 3. Kiến trúc Modular (Module-First)
Dự án hướng tới việc trở thành một "WMS vạn năng".

- **Phát triển tính năng mới**: Luôn cân nhắc tính năng đó là "Cơ bản" hay "Nâng cao" (Xem [developer_guide_modules.md](./developer_guide_modules.md)).
- **Tính khả đóng (Pluggability)**: Một module mới phải dễ dàng tích hợp vào trang Cấu hình mà không cần sửa đổi quá nhiều code ở các module khác.
- **Dùng chung (Shared Components)**: Sử dụng thư mục `src/components/shared` cho các UI element dùng chung để đảm bảo giao diện đồng nhất.

## 4. Quản lý tại Super Admin
Super Admin (`tungdibui2609@gmail.com`) là "chủ sân chơi".

- **Quyền hạn**: Tạo công ty, cấp phép module (unlocked_modules), quản lý trạng thái hoạt động của toàn hệ thống.
- **Giao diện**: Các trang quản trị Super Admin luôn nằm trong `/admin`.

---

**Ghi chú cho AI**: Trước khi thực hiện bất kỳ yêu cầu lập trình nào, hãy đọc file này cùng với file `ARCHITECTURE.md` và `developer_guide_modules.md`.
