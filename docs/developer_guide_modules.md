# Hướng dẫn Phát triển Hệ thống Module (Cơ bản vs Nâng cao)

Tài liệu này hướng dẫn cách phân loại, triển khai và yêu cầu AI hỗ trợ phát triển các tính năng mới dựa trên kiến trúc module hiện tại.

## 1. Quy tắc Phân loại (Categorization)

Khi bạn có một tính năng mới, hãy tự hỏi:

| Phân loại | Đặc điểm | Ví dụ |
| :--- | :--- | :--- |
| **Cơ bản (Basic)** | 90% khách hàng đều cần. Hệ thống không thể chạy nếu thiếu nó. | Mã phiếu, Ngày nhập, Kho lưu trữ, Thống kê tồn kho tổng quát. |
| **Nâng cao (Advanced)** | Tính năng chuyên sâu, đặc thù ngành, hoặc có giá trị gia tăng cao (để thu thêm phí). | Quản lý công trình, Bẻ gói tự động, Kế toán chuyên sâu, Quản lý Serial/IMEI. |

---

## 2. Quy trình Kỹ thuật khi thêm Module mới

### Bước 1: Khai báo Module
Thêm module vào các file định nghĩa tại `src/lib/`:
- `order-modules.ts` (Nhập/Xuất)
- `lot-modules.ts` (Quản lý LOT)
- `dashboard-modules.ts` (Báo cáo)
- `utility-modules.ts` (Tiện ích)

**Cấu trúc dữ liệu:**
```typescript
{
    id: 'ten_module_moi',
    name: 'Tên hiển thị',
    description: 'Mô tả tính năng',
    icon: IconComponent,
    is_basic: false, // true nếu là cơ bản
}
```

### Bước 2: Kiểm tra Phân quyền (Frontend)
Trong giao diện tính năng, hãy sử dụng Hook `useSystem` để kiểm tra:
```tsx
const { unlockedModules } = useSystem();
const isEnabled = unlockedModules.includes('ten_module_moi');

if (!isEnabled) return <NoAccessPlaceholder />;
```

---

## 3. Mẫu Câu lệnh (Prompt) cho AI

Khi yêu cầu AI phát triển module, hãy bắt đầu bằng:
> "Sử dụng workflow `.agent/workflows/module-dev.md` để phát triển tính năng X..."

Hoặc sử dụng các mẫu sau:
- *"Hãy thêm một module **Nâng cao** mới tên là 'Quản lý Dự toán' vào phân hệ **Nhập kho**..."*
- *"Tôi muốn đưa tính năng 'Gộp lô hàng' hiện tại vào diện module **Nâng cao**..."*

---

## 4. Lưu ý cho AI
- Bắt buộc đọc file này trước khi chỉnh sửa bất kỳ module nào.
- Đảm bảo Super Admin có thể bật/tắt module sau khi khai báo.
