---
description: Workflow phát triển và cấu hình Module (Cơ bản vs Nâng cao)
---

Bất cứ khi nào người dùng yêu cầu thêm tính năng mới hoặc thay đổi cấu hình module, bạn PHẢI thực hiện các bước sau:

1. Đọc hướng dẫn kiến trúc và định hướng tại: 
   - `d:\toanthang\web\docs\PROJECT_GUIDELINE.md`
   - `d:\toanthang\web\docs\developer_guide_modules.md`
2. Xác định tính năng thuộc loại **Cơ bản** hay **Nâng cao**.
3. **Khai báo Module**: Thực hiện khai báo trong các file `src/lib/*-modules.ts`.
4. **Triển khai Giao diện (UI)**: PHẢI sử dụng các thành phần dùng chung sau để đảm bảo tốc độ và tính đồng bộ:
   - **`useListingData`**: Dùng hook này để fetch và filter dữ liệu. KHÔNG viết lại `useEffect`/`useState` cho danh sách.
   - **`PageHeader`**: Dùng cho tiêu đề trang và nút Action.
   - **`StatusBadge`**: Dùng cho cột trạng thái Hoạt động/Ngừng.
   - **`EmptyState`**: Dùng khi không có dữ liệu.
5. **Tìm kiếm**: Sử dụng logic tìm kiếm động (recursive search) đã tích hợp trong `useListingData`.
6. **Kiểm tra**:
   - Filter trên các trang `src/components/settings/*ConfigSection.tsx`.
   - Trang quản trị Super Admin `admin/companies/[id]/modules`.
