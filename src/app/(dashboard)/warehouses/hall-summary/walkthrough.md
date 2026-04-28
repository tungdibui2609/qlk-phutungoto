# Walkthrough - Sửa lỗi hiển thị tên sản phẩm trong Thống kê Sảnh

Dưới đây là mô tả về các thay đổi được thực hiện để khắc phục lỗi không hiển thị tên sản phẩm trên trang Thống kê Sảnh.

## 🛠 Thay đổi thực hiện

### 1. Đồng bộ hóa tên thuộc tính dữ liệu
- **Vấn đề**: Trong quá trình map dữ liệu từ Supabase, thuộc tính tên sản phẩm được gán vào key `product_name`. Tuy nhiên, trong logic hiển thị, tìm kiếm và xuất Excel, hệ thống lại truy cập vào key `name`. Điều này dẫn đến việc tất cả các thẻ sản phẩm đều hiển thị mặc định là "Không có tên".
- **Giải pháp**: Đã thay đổi việc gán dữ liệu từ `product_name` thành `name` trong hàm `loadData`.

```typescript
// Trước khi sửa
product_name: li.products?.name,

// Sau khi sửa
name: li.products?.name,
```

## 🏗 Tuân thủ kiến trúc phân hệ (System-Aware)

Tính năng này hoàn toàn tuân thủ các nguyên tắc được đề ra trong `AGENTS.md`:

1. **Cô lập dữ liệu**: Trang sử dụng `systemType` từ `SystemContext` để lọc dữ liệu ngay từ tầng truy vấn:
   - Truy vấn bảng `zones` với điều kiện `.eq('system_type', systemType)`.
   - Truy vấn bảng `positions` với điều kiện `.eq('system_type', systemType)`.
   - Điều này đảm bảo người dùng ở phân hệ này (ví dụ: Phụ tùng ô tô) không bao giờ nhìn thấy dữ liệu của phân hệ khác.

2. **Modular**: Tính năng được xây dựng như một module báo cáo độc lập, dễ dàng bật/tắt hoặc mở rộng trong tương lai.

3. **Multi-tenant Ready**: Cấu trúc hiện tại sử dụng `system_type` làm lớp lọc chính, sẵn sàng để bổ sung thêm các lớp lọc khác (như `customer_id`) nếu cần thiết mà không phải thay đổi logic gộp dữ liệu.

## ✅ Xác minh
- Tên sản phẩm hiện đã hiển thị chính xác trên các thẻ (cards).
- Chức năng tìm kiếm theo tên sản phẩm đã hoạt động trở lại.
- Xuất file Excel đã có đầy đủ tên sản phẩm ở cột "Tên Sản Phẩm".
