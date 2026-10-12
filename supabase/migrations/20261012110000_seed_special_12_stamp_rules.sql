-- Migration: Bổ sung danh mục quy cách ngoại lệ (12 số đầu) vào stamp_dictionaries
-- Áp dụng bảng quy cách mã 12 ký tự đầu tiên cho thành phẩm sầu riêng, mít, xoài, thanh long, dứa

DELETE FROM public.stamp_dictionaries WHERE category = 'special_12';

INSERT INTO public.stamp_dictionaries (category, code, name, description, is_active, sort_order)
VALUES
-- TP cấp đông sầu riêng trái
('special_12', '101010202002', 'TP cấp đông sầu riêng trái ri 6 loại A - Nito', 'TP cấp đông sầu riêng trái', true, 1),
('special_12', '101010202004', 'TP cấp đông sầu riêng trái ri 6 loại A - Hàng đóng thùng tạm', 'TP cấp đông sầu riêng trái', true, 2),
('special_12', '101010402004', 'TP cấp đông sầu riêng trái Musaking loại A - Nito - Hàng đóng thùng tạm', 'TP cấp đông sầu riêng trái', true, 3),
('special_12', '101010403004', 'TP cấp đông sầu riêng trái Musaking loại B - Nito - Hàng đóng thùng tạm', 'TP cấp đông sầu riêng trái', true, 4),

-- TP cấp đông sầu riêng múi
('special_12', '102010201001', 'TP cấp đông sầu riêng múi monthong A (1 túi) - Hầm đông', 'TP cấp đông sầu riêng múi', true, 5),
('special_12', '102010201002', 'TP cấp đông sầu riêng múi monthong A (1 túi) - Nito', 'TP cấp đông sầu riêng múi', true, 6),
('special_12', '102010201004', 'TP cấp đông sầu riêng múi monthong A (1 túi) - múi to (>750gram) - Hầm đông', 'TP cấp đông sầu riêng múi', true, 7),
('special_12', '102010201005', 'TP cấp đông sầu riêng múi monthong A (1 túi) - múi nhỏ (< 60 gram) - Hầm đông', 'TP cấp đông sầu riêng múi', true, 8),
('special_12', '102010204001', 'TP cấp đông sầu riêng múi monthong A (4 túi) - Hầm đông', 'TP cấp đông sầu riêng múi', true, 9),
('special_12', '102010301001', 'TP cấp đông sầu riêng múi monthong B (1 túi) - Hầm đông', 'TP cấp đông sầu riêng múi', true, 10),
('special_12', '102010301002', 'TP cấp đông sầu riêng múi monthong B (1 túi) - Nito', 'TP cấp đông sầu riêng múi', true, 11),
('special_12', '102010301004', 'TP cấp đông sầu riêng múi monthong B (1 túi) - múi to (>750gram) - Hầm đông', 'TP cấp đông sầu riêng múi', true, 12),
('special_12', '102010301005', 'TP cấp đông sầu riêng múi monthong B (1 túi) - múi nhỏ (< 60 gram) - Hầm đông', 'TP cấp đông sầu riêng múi', true, 13),
('special_12', '102010304001', 'TP cấp đông sầu riêng múi monthong B (4 túi) - Hầm đông', 'TP cấp đông sầu riêng múi', true, 14),
('special_12', '102010401001', 'TP cấp đông sầu riêng múi monthong C - Hàng không hạt - Hầm đông', 'TP cấp đông sầu riêng múi', true, 15),
('special_12', '102010402001', 'TP cấp đông sầu riêng múi monthong C - Hàng có hạt - Hầm đông', 'TP cấp đông sầu riêng múi', true, 16),
('special_12', '102020201001', 'TP cấp đông sầu riêng múi ri 6 A (1 túi) - Hầm đông', 'TP cấp đông sầu riêng múi', true, 17),
('special_12', '102020204001', 'TP cấp đông sầu riêng múi ri 6 A (4 túi) - Hầm đông', 'TP cấp đông sầu riêng múi', true, 18),
('special_12', '102020301001', 'TP cấp đông sầu riêng múi ri 6 B (1 túi) - Hầm đông', 'TP cấp đông sầu riêng múi', true, 19),
('special_12', '102020304001', 'TP cấp đông sầu riêng múi ri 6 B (4 túi) - Hầm đông', 'TP cấp đông sầu riêng múi', true, 20),
('special_12', '102020401001', 'TP cấp đông sầu riêng múi ri 6 C - Hàng có hạt - Hầm đông', 'TP cấp đông sầu riêng múi', true, 21),
('special_12', '102020402001', 'TP cấp đông sầu riêng múi ri 6 C - Hàng tách hạt - Hầm đông', 'TP cấp đông sầu riêng múi', true, 22),
('special_12', '102020701000', 'TP cấp đông sầu riêng múi ri 6 khay (có hạt)', 'TP cấp đông sầu riêng múi', true, 23),

-- TP cấp đông mít
('special_12', '202010100000', 'TP cấp đông múi mít đỏ loại A', 'TP cấp đông mít', true, 24),
('special_12', '202010200000', 'TP cấp đông múi mít đỏ loại B', 'TP cấp đông mít', true, 25),
('special_12', '202010300000', 'TP cấp đông múi mít đỏ loại C', 'TP cấp đông mít', true, 26),
('special_12', '202010400000', 'TP cấp đông múi mít đỏ loại D', 'TP cấp đông mít', true, 27),

-- TP cấp đông xoài
('special_12', '201090200102', 'TP cấp đông xoài Keaw cắt má loại A (Thùng 10 Kg)', 'TP cấp đông xoài', true, 28),
('special_12', '201090200302', 'TP cấp đông xoài Keaw cắt má loại B (Thùng 10 Kg)', 'TP cấp đông xoài', true, 29),
('special_12', '201090200402', 'TP cấp đông xoài Keaw cắt má loại C (Thùng 10 Kg)', 'TP cấp đông xoài', true, 30),
('special_12', '201090200702', 'TP cấp đông xoài Keaw vụn (Thùng 10 Kg)', 'TP cấp đông xoài', true, 31),
('special_12', '201090300200', 'TP cấp đông xoài Keaw cắt dice 20x20mm', 'TP cấp đông xoài', true, 32),

-- TP cấp đông thanh long
('special_12', '301010400000', 'TP cấp đông thanh long đỏ 6x6mm', 'TP cấp đông thanh long', true, 33),
('special_12', '301020200000', 'TP cấp đông thanh long trắng 15x15mm', 'TP cấp đông thanh long', true, 34),

-- TP cấp đông dứa
('special_12', '901010050000', 'TP cấp đông dứa queen (1/2 trái)', 'TP cấp đông dứa', true, 35),
('special_12', '901030050000', 'TP cấp đông dứa cayenne (1/2 trái)', 'TP cấp đông dứa', true, 36);

NOTIFY pgrst, 'reload schema';
