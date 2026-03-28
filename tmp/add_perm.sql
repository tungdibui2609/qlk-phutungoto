INSERT INTO permissions (code, name, module, description)
VALUES 
('lot.create', 'Tạo LOT Sản xuất', 'Hàng hóa', 'Cho phép tạo mới các lô hàng sản xuất'),
('warehouse_lot.create', 'Tạo Quản lý LOT', 'Hàng hóa', 'Cho phép tạo mới các lô hàng trong quản lý LOT')
ON CONFLICT (code) DO NOTHING;
