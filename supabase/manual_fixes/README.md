# Hướng dẫn chạy SQL vá lỗi Security & Performance Advisor (Supabase Local)

> **Lưu ý:** Không tự động đặt vào `supabase/migrations/` để tránh CLI tự chạy ngoài ý muốn. Hãy chạy thủ công trong **Supabase Studio Local (`http://localhost:64323` -> SQL Editor)**.

## Bước 0: Backup DB Local trước khi chạy (Bắt buộc)
Mở terminal tại thư mục dự án và chạy 1 lệnh backup toàn bộ DB local:
```powershell
npx supabase db dump --local -f "backup_before_rls.sql"
```

## Bước 1: Chạy Gói 1 (`01_zero_risk_fix.sql`) — An toàn 100%
* Dọn 4 lỗi đỏ `user_metadata` trên `positions`.
* Tối ưu cảnh báo vàng `Auth RLS Initialization Plan`.
* **Chạy được bất cứ lúc nào**, không làm đổi hành vi phân quyền của người dùng.

## Bước 2: Chạy Gói 2 (`02_enable_rls_safe.sql`) — Khuyến nghị chạy cuối ngày / khi kho nghỉ
* Bật RLS chặn người chưa đăng nhập (`anon`) cho 12 bảng bị cảnh báo đỏ.
* Gắn tự động điền `company_id` cho `lot_items`, `inbound_order_items`, `outbound_order_items`, `audit_logs`.
* Chuyển 2 view thống kê sang `security_invoker = true`.

Sau khi chạy xong Bước 2, vào web bấm kiểm tra nhanh 4 thao tác:
1. Đăng nhập & xem danh sách nhân viên (`/users`).
2. Xem tồn kho & tạo mới / tách 1 Lot (hoặc kiểm tra Kho Đông Lạnh).
3. Xem đơn nhập / xuất kho.
4. Xem thống kê sản xuất.

## Nếu có bất kỳ lỗi nào:
Copy toàn bộ nội dung file `99_rollback_rls.sql` dán vào SQL Editor và bấm Run để hoàn tác ngay lập tức về trạng thái ban đầu.
