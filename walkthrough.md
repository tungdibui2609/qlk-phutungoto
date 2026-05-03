# Walkthrough: Sửa lỗi tính năng "Hạ sảnh" (Move to Hall)

Tài liệu này mô tả các thay đổi kỹ thuật để khắc phục lỗi không hiển thị Sảnh và lỗi khi thực hiện di chuyển hàng hóa vào Sảnh trong giao diện Chi tiết Lệnh xuất kho.

## 1. Vấn đề (Problem)
- **Giới hạn dữ liệu**: Khi số lượng Zone trong hệ thống vượt quá 1000 (hiện tại là 3473), các Zone được đánh dấu là "Sảnh" có thể không được tải lên Client do giới hạn mặc định của Supabase.
- **Thiếu lọc Phân hệ**: Các truy vấn Zone chưa được lọc theo `system_type`, dẫn đến việc tải thừa dữ liệu của các kho khác và vi phạm nguyên tắc cô lập dữ liệu.
- **Logic di chuyển chưa tối ưu**: Logic di chuyển hàng vào Sảnh dựa trên Lot ID thay vì Placement (Vị trí), dẫn đến sai sót nếu một Lô hàng nằm ở nhiều vị trí.

## 2. Giải pháp (Solution)

### A. Tải dữ liệu Zone theo phân đoạn (Chunked Fetching) & Lọc Phân hệ
Đã cập nhật hàm `fetchZones` và logic tải zone trong `fetchTaskDetails` để:
- Sử dụng vòng lặp `while` để tải tất cả các Zone theo từng trang (1000 row/trang).
- Luôn thêm điều kiện lọc `.eq('system_type', currentSystem?.code)` để đảm bảo chỉ lấy dữ liệu của phân hệ hiện hành.

### B. Cải tiến logic "Hạ sảnh" (`handleMoveToHall`)
- **Theo dõi Vị trí Hiện tại**: Cập nhật query `fetchTaskDetails` để lấy thêm `id` của vị trí hiện tại của Lô hàng.
- **Di chuyển theo Item**: Thay vì gom nhóm theo Lot ID, hệ thống giờ đây di chuyển từng Item được chọn. Điều này đảm bảo nếu bạn chọn 3 pallet của cùng 1 Lô, hệ thống sẽ tìm đúng 3 vị trí trống trong Sảnh để hạ.
- **Lọc Phân hệ cho Vị trí Trống**: Khi tìm vị trí trống trong Sảnh, đã thêm điều kiện lọc `system_type` để đảm bảo không lấy nhầm vị trí của phân hệ khác.

### C. Tự động tìm Sảnh (Automatic Hall Selection)
Đã thêm khả năng chọn toàn bộ Kho (Warehouse) thay vì phải chọn chính xác từng Sảnh:
- **Giao diện Modal**: Người dùng có thể chọn trực tiếp các Warehouse (như KHO 2, KHO 3). Giao diện hiển thị nhãn "Tự động tìm sảnh trống" để chỉ dẫn.
- **Xử lý thông minh**: Khi một Warehouse được chọn, hệ thống sẽ:
    1. Tìm tất cả các khu vực được đánh dấu là `is_hall` bên trong Warehouse đó.
    2. Tập hợp tất cả các vị trí con của các sảnh này.
    3. Tìm các vị trí còn trống và tự động phân bổ hàng hóa vào đó.
- **Tiết kiệm thao tác**: Giúp giảm thiểu sai sót và tăng tốc độ xử lý khi người dùng không cần nhớ chính xác hàng sẽ được hạ vào sảnh nào.

## 3. Kết quả (Results)
- Danh sách Sảnh trong Modal `SelectHallModal` sẽ luôn hiển thị đầy đủ các khu vực được đánh dấu là Sảnh của kho hiện tại.
- Tính năng "Hạ sảnh" hoạt động chính xác, giải phóng đúng vị trí cũ và gán vào vị trí mới trong Sảnh.
- Tuân thủ quy tắc "System-Aware" trong `AGENTS.md`.

---
*Người thực hiện: Antigravity Agent*
