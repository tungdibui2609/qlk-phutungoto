# Walkthrough: Sửa Lỗi Tìm Kiếm Số Thứ Tự (STT) Pallet Dạng Chữ + Số

Tài liệu này mô tả chi tiết các thay đổi kỹ thuật để sửa lỗi chức năng tìm kiếm Số thứ tự (STT) Pallet tại trang quản lý Lot (`/warehouses/lots`), đảm bảo hệ thống hỗ trợ tìm kiếm đầy đủ cả hai định dạng: số thuần túy (ví dụ: `47`) và chữ cái kết hợp số (ví dụ: `A47`).

---

## 🎯 1. Nguyên Nhân Lỗi & Giải Pháp

### Nguyên Nhân
- Trước đây, khi người dùng nhập chuỗi tìm kiếm STT (ví dụ: `A47` hoặc `LSX:A47`), hệ thống sử dụng hàm `parseInt` để chuyển đổi chuỗi tìm kiếm thành số nguyên trước khi thực hiện truy vấn xuống cơ sở dữ liệu (`daily_seq` là cột `INTEGER`).
- Tuy nhiên, `parseInt("A47")` sẽ trả về `NaN`, dẫn đến việc truy vấn bị bỏ qua hoặc không khớp được dữ liệu nào.

### Giải Pháp
- Thay thế hàm `parseInt` bằng hàm `encodeSTT` từ thư viện tiện ích dùng chung `@/lib/numberUtils`.
- Hàm `encodeSTT` đã được thiết kế sẵn để mã hóa chính xác các định dạng STT dạng chữ + số thành số nguyên lưu trữ trong database (ví dụ: `A47` -> `100047`) và giữ nguyên số nguyên đối với các số thông thường (ví dụ: `47` -> `47`).

---

## 🏗️ 2. Chi Tiết Các Thay Đổi Kỹ Thuật

### A. Nhập Tiện Ích `encodeSTT` vào Hook Quản Lý Lot
- **File sửa đổi:** [useLotManagement.ts](file:///d:/chanh%20thu/web/src/app/%28dashboard%29/warehouses/lots/_hooks/useLotManagement.ts)
- **Nội dung:** Import hàm `encodeSTT` từ `@/lib/numberUtils` để tái sử dụng cơ chế mã hóa STT đồng bộ với hệ thống lưu trữ dữ liệu.
  ```typescript
  import { encodeSTT } from '@/lib/numberUtils'
  ```

### B. Cập Nhật Logic Tìm Kiếm Trong `useLotManagement.ts`
Chúng tôi đã cập nhật 3 vị trí xử lý tìm kiếm STT trong hook `useLotManagement`:

1. **Tìm kiếm nâng cao dạng `Lệnh_Sản_Xuất:STT` (Dòng ~371):**
   - *Trước đây:* Sử dụng `parseInt` để phân tích phần STT.
   - *Hiện tại:* Sử dụng `encodeSTT` để giải quyết STT dạng chữ cái + số.
   ```typescript
   const sttTerm = encodeSTT(parts[1]);
   if (sttTerm !== null) { ... }
   ```

2. **Tìm kiếm ở chế độ "Tất cả" (`searchMode === 'all'`) (Dòng ~596):**
   - *Trước đây:* Sử dụng `parseInt(part)` để lọc theo cột `daily_seq`.
   - *Hiện tại:* Sử dụng `encodeSTT(part)` giúp lọc được cả mã pallet chứa chữ cái tiền tố.
   ```typescript
   const sttNum = encodeSTT(part);
   if (sttNum !== null) { ... }
   ```

3. **Tìm kiếm chuyên biệt theo số thứ tự (`searchMode === 'stt'`) (Dòng ~612):**
   - *Trước đây:* Sử dụng `parseInt(part)`.
   - *Hiện tại:* Sử dụng `encodeSTT(part)`.
   ```typescript
   const sttNum = encodeSTT(part);
   if (sttNum !== null) { ... }
   ```

---

## 🔒 3. Bảo Mật & Cô Lập Dữ Liệu Phân Hệ (`system_code`)

Thay đổi này hoàn toàn tuân thủ các chỉ thị bảo mật nghiêm ngặt trong [AGENTS.md](file:///d:/chanh%20thu/web/agents.md):
- **Không rò rỉ dữ liệu:** Logic tìm kiếm STT sau khi mã hóa giá trị vẫn sử dụng các điều kiện ràng buộc cô lập hệ thống ban đầu:
  ```typescript
  .eq('daily_seq', sttNum)
  .eq('system_code', currentSystem.code) // Ràng buộc cô lập phân hệ kho hiện tại
  .neq('status', 'hidden')
  .neq('status', 'exported')
  ```
- **System-Aware:** Bộ lọc `system_code` luôn được áp dụng đầy đủ trên mọi câu lệnh truy vấn tới bảng `lots` để đảm bảo dữ liệu của phân hệ kho này không bao giờ xuất hiện ở phân hệ kho khác.

---
*Người thực hiện: Antigravity Agent - Google DeepMind*
