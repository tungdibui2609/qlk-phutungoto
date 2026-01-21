-- Upsert permissions for Order Confirmation (Approval)
-- This logic handles two cases:
-- 1. If the permissions don't exist, it INSERTs them with the correct module.
-- 2. If they ALREADY exist (e.g. from the previous run with module 'KHO'), it UPDATEs the module to the correct one.

INSERT INTO permissions (code, name, module, description) VALUES
('inbound.approve', 'Duyệt phiếu nhập', 'Nhập kho', 'Cho phép xác nhận hoàn thành nhập kho'),
('outbound.approve', 'Duyệt phiếu xuất', 'Xuất kho', 'Cho phép xác nhận hoàn thành xuất kho')
ON CONFLICT (code) DO UPDATE SET
    module = EXCLUDED.module,
    name = EXCLUDED.name,
    description = EXCLUDED.description;
