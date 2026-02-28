-- Chạy đoạn mã này trong SQL Editor của Supabase để cập nhật lại tên chi nhánh cũ sang tên mới
-- Thay thế 'CN Đắk lắk' bằng tên cũ chính xác và 'CN Cư M''gar' bằng tên mới chính xác nếu cần (Lưu ý: dấu nháy đơn trong M'gar phải đổi thành M''gar trong SQL)

BEGIN;

-- 1. Cập nhật bảng LOTS
UPDATE public.lots
SET warehouse_name = 'CN Cư M''gar'
WHERE warehouse_name = 'CN Đắk Lắk';

-- 2. Cập nhật bảng INBOUND_ORDERS (Phiếu nhập)
UPDATE public.inbound_orders
SET warehouse_name = 'CN Cư M''gar'
WHERE warehouse_name = 'CN Đắk Lắk';

-- 3. Cập nhật bảng OUTBOUND_ORDERS (Phiếu xuất)
UPDATE public.outbound_orders
SET warehouse_name = 'CN Cư M''gar'
WHERE warehouse_name = 'CN Đắk Lắk';

-- 4. Cập nhật bảng INVENTORY_CHECKS (Phiếu kiểm kê)
UPDATE public.inventory_checks
SET warehouse_name = 'CN Cư M''gar'
WHERE warehouse_name = 'CN Đắk Lắk';

-- 5. Cập nhật bảng LOCATIONS (Nếu có lưu name hoặc notes liên quan)
UPDATE public.locations
SET name = 'CN Cư M''gar'
WHERE name = 'CN Đắk Lắk';

COMMIT;
