# Modular WMS - Hệ Thống Quản Lý Kho Linh Hoạt

Hệ thống quản lý kho (WMS) đa năng, được thiết kế theo kiến trúc modular cho phép tùy chỉnh linh hoạt phù hợp với mọi nhu cầu quản lý kho bãi.

## 🚀 Tầm Nhìn Dự Án
Xây dựng một nền tảng quản lý kho vạn năng. Thay vì một ứng dụng đóng gói sẵn, **Modular WMS** cung cấp các thành phần cốt lõi và các module bổ trợ giúp người dùng cấu hình hệ thống phù hợp nhất với đặc thù kho của mình (từ kho phụ tùng, kho thực phẩm đến kho sản xuất).

## 🧩 Đặc Điểm Nổi Bật
- **Kiến Trúc Modular**: Các tính năng (Đơn vị tính, Quy cách đóng gói, QC, Pricing...) được thiết kế thành các module độc lập.
- **Tùy Biến Linh Hoạt**: Dễ dàng bật/tắt hoặc tích hợp thêm module mới để phù hợp với từng loại kho.
- **Quản Lý Đa Hệ Thống**: Hỗ trợ vận hành nhiều loại kho với các cấu hình module khác nhau trên cùng một nền tảng.
- **Trải Nghiệm Hiện Đại**: UI/UX tối ưu với Next.js, Tailwind CSS và bộ icon Lucide.

## 🛠 Tính Năng Cốt Lõi
- **Quản lý Nhập/Xuất (Inbound/Outbound)**: Quy trình nghiệp vụ chuẩn hóa, chặt chẽ.
- **Tồn kho & Lô hàng (Inventory & Lot)**: Theo dõi số lượng, vị trí và lịch sử biến động chi tiết đến từng lô hàng.
- **Hệ Thống Vị Trí**: Quản lý layout kho trực quan, tối ưu hóa việc sắp xếp và tìm kiếm.
- **In ấn & QR Code**: Hỗ trợ in tem nhãn, mã QR để truy xuất thông tin nhanh chóng và chính xác.
- **Báo cáo & Thống kê**: Cung cấp cái nhìn tổng quan và chi tiết về hiệu quả vận hành kho.

## 💻 Công Nghệ Sử Dụng
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Components**: Radix UI / Shadcn UI

## ⚙️ Cài Đặt Phát Triển

1. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

2. **Cấu hình biến môi trường:**
   Tạo file `.env.local` dựa trên mẫu `.env.local.example` và điền các tham số kết nối Supabase.

3. **Chạy môi trường development:**
   ```bash
   npm run dev
   ```

4. **Làm việc với Supabase (Local):**
   Nếu bạn sử dụng Supabase local development:
   ```bash
   npx supabase start
   ```

---
*Dự án đang trong quá trình phát triển tích cực để hoàn thiện các module quản lý chuyên sâu.*