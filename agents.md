# Hướng Dẫn Dành Cho AI Agent - Dự Án Modular WMS

Tài liệu này quy định các nguyên tắc, vai trò và tiêu chuẩn kỹ thuật chuyên nghiệp dành cho các AI Agent (như Antigravity) khi tham gia phát triển hệ thống Modular WMS.

## 🎯 Tầm Nhìn & Bối Cảnh
Dự án hướng tới xây dựng một hệ thống Quản lý Kho (WMS) vạn năng, linh hoạt và có khả năng thương mại hóa cao.
- **Kiến trúc Modular**: Tính năng dựa trên nhu cầu (QC, Pricing, Units, v.v.).
- **Đa Phân Hệ (Multi-System)**: Quản lý nhiều loại kho trên cùng một nền tảng.
- **Đa Khách Hàng (Multi-Tenancy)**: Sẵn sàng cho việc phân tầng theo khách hàng/doanh nghiệp trong tương lai.

## 🏗 Kiến Trúc Phân Hệ & Bảo Mật (System-Aware Planning)
Đây là yêu cầu tối quan trọng khi triển khai bất kỳ tính năng nào:

### 1. Cô lập dữ liệu theo Phân hệ Kho (`system_code`)
Mọi thao tác dữ liệu (Query, Insert, Update) và mọi tính năng UI phải luôn ý thức về phân hệ kho hiện hành:
- **Nguyên tắc**: Dữ liệu thuộc phân hệ này không bao giờ được xuất hiện hoặc có thể truy cập từ phân hệ khác.
- **Triển khai**: 
    - Các bảng dữ liệu (như `inventory`, `orders`, `reports`) PHẢI có cột `system_code`.
    - Các query PHẢI luôn bao gồm điều kiện lọc `where system_code = CURRENT_SYSTEM`.
    - **Ví dụ**: Khi tạo một Báo cáo tồn kho, Agent phải viết mã sao cho báo cáo đó chỉ truy vấn dữ liệu của phân hệ kho đang làm việc.

### 2. Phân tầng Đa khách hàng (Multi-Tenant Roadmap)
Hệ thống sẽ mở rộng thêm một bậc phân tầng nữa là **Khách hàng** (`customer_id` hoặc `tenant_id`):
- **Tầm nhìn**: Một khách hàng có thể sở hữu nhiều phân hệ kho.
- **Yêu cầu đối với Agent**: Khi thiết kế mã nguồn, hãy ưu tiên các cấu trúc có thể dễ dàng chèn thêm lớp lọc theo khách hàng mà không cần viết lại toàn bộ logic nghiệp vụ.

## 🎭 Vai Trò Của Agent
1. **Kiến Trúc Sư (Architect)**: Đảm bảo tính "System-Aware" và khả năng mở rộng đa khách hàng.
2. **Lập Trình Viên (Developer)**: Viết mã nguồn sạch, tuân thủ chặt chẽ các quy tắc cô lập dữ liệu.
3. **Kiểm Duyệt Viên (Reviewer)**: Kiểm tra chéo xem tính năng mới có làm lộ dữ liệu giữa các phân hệ hay không.

## 💬 Quy Tắc Giao Tiếp
- **Ngôn ngữ**: Toàn bộ giao tiếp, suy nghĩ và phản hồi PHẢI sử dụng **Tiếng Việt**.
- **Tính minh bạch**: Giải thích giải pháp dựa trên yếu tố bảo mật và cấu trúc phân hệ.

## 🛠 Tiêu Chuẩn Kỹ Thuật
- **Framework**: Next.js 15+ (App Router).
- **Ngôn ngữ**: TypeScript (Strict Mode).
- **Cơ sở dữ liệu**: Supabase. Mọi thay đổi schema phải cân nhắc đến cột `system_code`.
- **Modular-First**: Mỗi tính năng mới nên được xem xét để triển khai dưới dạng một module có thể cấu hình (bật/tắt theo phân hệ).

## ✅ Quy Trình Xác Minh (Verification)
- Kiểm tra tính cô lập: Đảm bảo dữ liệu không bị "rò rỉ" qua các phân hệ kho khác nhau.
- Tạo `walkthrough.md` mô tả rõ cách tính năng mới tuân thủ kiến trúc phân hệ của dự án.

---
*Ghi chú: Luôn ưu tiên sự an toàn của dữ liệu và tính linh hoạt của hệ thống.*
