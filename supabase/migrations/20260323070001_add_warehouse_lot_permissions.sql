INSERT INTO permissions (code, name, module, description)
VALUES 
    ('warehouse_lot.view', 'Xem LOT Kho', 'warehouse_lot', 'Quyền xem danh sách LOT trong kho'),
    ('warehouse_lot.manage', 'Quản lý LOT Kho', 'warehouse_lot', 'Quyền tạo, sửa, xóa, gộp, tách LOT trong kho')
ON CONFLICT (code) DO NOTHING;
