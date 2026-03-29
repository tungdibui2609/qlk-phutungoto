INSERT INTO permissions (code, name, module, description)
VALUES 
    ('fresh_material.view', 'Xem nguyên liệu tươi', 'Nguyên liệu tươi', 'Xem danh sách và tồn kho nguyên liệu tươi'),
    ('fresh_material.manage', 'Quản lý nguyên liệu tươi', 'Nguyên liệu tươi', 'Thêm, sửa, xóa, duyệt lô nguyên liệu tươi'),
    ('production_issue.view', 'Xem cấp phát sản xuất', 'Cấp phát sản xuất', 'Xem danh sách cấp phát nguyên liệu sản xuất'),
    ('production_issue.manage', 'Quản lý cấp phát sản xuất', 'Cấp phát sản xuất', 'Thêm, sửa, xóa, duyệt cấp phát sản xuất'),
    ('production.view', 'Xem lệnh sản xuất', 'Sản xuất', 'Xem danh sách lệnh sản xuất'),
    ('production.manage', 'Quản lý lệnh sản xuất', 'Sản xuất', 'Thêm, sửa, xóa, quản lý định mức sản xuất')
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name,
    module = EXCLUDED.module,
    description = EXCLUDED.description;
