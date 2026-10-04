# 🛑 QUY TẮC BẮT BUỘC: ĐIỀU KIỆN BUILD FILE APK (EAS BUILD POLICY)

**NGHIÊM CẤM TỰ ĐỘNG CHẠY LỆNH BUILD APK (`eas build`, `eas-cli build`) KHI CHƯA CÓ LỆNH RÕ RÀNG TỪ NGƯỜI DÙNG.**

## 1. Điều kiện tiên quyết để được phép Build:
Agent CHỈ ĐƯỢC PHÉP chạy lệnh build APK (`eas-cli build`, `eas build`) khi và chỉ khi người dùng trực tiếp đưa ra yêu cầu bằng văn bản rõ ràng trong tin nhắn hiện tại, ví dụ:
- *"Hãy build apk"* / *"Build file apk đi"*
- *"Xuất file apk"* / *"Tạo file apk cho tôi"*
- *"Chạy build"* / *"Build bản mới cho tôi test"*

## 2. Các hành vi BỊ CẤM:
- **CẤM** tự ý chạy `eas build` sau khi vừa fix xong một lỗi (bug fix) mà không hỏi người dùng.
- **CẤM** tự ý chạy `eas build` sau khi thêm một tính năng mới mà người dùng chưa yêu cầu đóng gói.
- **CẤM** tự động kích hoạt tiến trình build trong quá trình tư vấn, phân tích hoặc giải thích logic.

## 3. Quy trình chuẩn khi phát triển & sửa lỗi:
1. Thực hiện chỉnh sửa code, cấu hình theo yêu cầu.
2. Kiểm tra tính toàn vẹn và không có lỗi kiểu dữ liệu:
   ```bash
   npx tsc --noEmit
   ```
3. Commit code vào git nội bộ.
4. Báo cáo chi tiết cho người dùng những gì đã sửa/hoàn thiện.
5. Hỏi ý kiến người dùng hoặc chờ người dùng ra lệnh: *"Khi nào anh muốn xuất bản APK mới để test, hãy báo em nhé"*.
6. CHỈ khởi chạy lệnh build APK khi người dùng xác nhận đồng ý!
