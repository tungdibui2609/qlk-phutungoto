---
description: Workflow phát triển và cấu hình Module (Cơ bản vs Nâng cao)
---

Bất cứ khi nào người dùng yêu cầu thêm tính năng mới hoặc thay đổi cấu hình module, bạn PHẢI thực hiện các bước sau:

1. Đọc hướng dẫn kiến trúc và định hướng tại: 
   - `d:\toanthang\web\docs\PROJECT_GUIDELINE.md`
   - `d:\toanthang\web\docs\developer_guide_modules.md`
2. Xác định tính năng thuộc loại **Cơ bản** hay **Nâng cao**.
3. Thực hiện khai báo trong các file `src/lib/*-modules.ts`.
4. Kiểm tra việc thực thi filter trên các trang `src/components/settings/*ConfigSection.tsx`.
5. Đảm bảo trang quản trị Super Admin `admin/companies/[id]/modules` hiển thị đúng module mới.
