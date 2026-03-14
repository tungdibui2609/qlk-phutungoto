-- Cập nhật bảng quy tắc mã và nạp dữ liệu cho hệ thống KHO_DONG_LANH
DROP TABLE IF EXISTS public.internal_product_code_rules CASCADE;

CREATE TABLE public.internal_product_code_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level INTEGER NOT NULL CHECK (level IN (1, 2, 3, 4)),
    prefix TEXT NOT NULL,
    description TEXT NOT NULL,
    system_code TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bật RLS
ALTER TABLE public.internal_product_code_rules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.internal_product_code_rules FOR SELECT USING (true);
CREATE POLICY "Enable all for authenticated users" ON public.internal_product_code_rules FOR ALL USING (auth.role() = 'authenticated');

-- Cập nhật bảng products để lưu lựa chọn 4 cấp độ
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS internal_lvl1_id UUID REFERENCES public.internal_product_code_rules(id),
ADD COLUMN IF NOT EXISTS internal_lvl2_id UUID REFERENCES public.internal_product_code_rules(id),
ADD COLUMN IF NOT EXISTS internal_lvl3_id UUID REFERENCES public.internal_product_code_rules(id),
ADD COLUMN IF NOT EXISTS internal_lvl4_id UUID REFERENCES public.internal_product_code_rules(id);

-- Nạp dữ liệu từ hình ảnh cho hệ thống KHO_DONG_LANH
-- Cấp 1: Sản phẩm
INSERT INTO public.internal_product_code_rules (level, prefix, description, system_code, sort_order) VALUES
(1, 'DO', 'Dona', 'KHO_DONG_LANH', 1),
(1, 'RI', 'RI-6', 'KHO_DONG_LANH', 2),
(1, 'XK', 'Xoài keaw', 'KHO_DONG_LANH', 3),
(1, 'DQ', 'Dứa Queen', 'KHO_DONG_LANH', 4),
(1, 'DM', 'Dứa MD2', 'KHO_DONG_LANH', 5),
(1, 'TD', 'Thanh long đỏ', 'KHO_DONG_LANH', 6),
(1, 'TT', 'Thanh long trắng', 'KHO_DONG_LANH', 7),
(1, 'CD', 'Chanh Dây', 'KHO_DONG_LANH', 8);

-- Cấp 2: Hình thức
INSERT INTO public.internal_product_code_rules (level, prefix, description, system_code, sort_order) VALUES
(2, 'M', 'Cấp đông múi, má', 'KHO_DONG_LANH', 1),
(2, 'D', 'Cấp đông dạng dice', 'KHO_DONG_LANH', 2),
(2, 'T', 'Cấp đông nguyên trái', 'KHO_DONG_LANH', 3),
(2, 'H', 'Cấp đông Half Cut', 'KHO_DONG_LANH', 4);

-- Cấp 3: Phân loại
INSERT INTO public.internal_product_code_rules (level, prefix, description, system_code, sort_order) VALUES
(3, 'A00', 'Loại A không hạt', 'KHO_DONG_LANH', 1),
(3, 'A01', 'Loại A thường', 'KHO_DONG_LANH', 2),
(3, 'B00', 'Loại B không hạt', 'KHO_DONG_LANH', 3),
(3, 'B01', 'Loại B thường', 'KHO_DONG_LANH', 4),
(3, 'B02', 'Loại B to', 'KHO_DONG_LANH', 5),
(3, 'C00', 'Loại C không hạt ( vụn )', 'KHO_DONG_LANH', 6),
(3, 'C01', 'Loại C thường', 'KHO_DONG_LANH', 7),
(3, 'C02', 'Loại C to', 'KHO_DONG_LANH', 8),
(3, '010', 'Dice 10x10', 'KHO_DONG_LANH', 9),
(3, '015', 'Dice 15x15', 'KHO_DONG_LANH', 10),
(3, '020', 'Dice 20x20', 'KHO_DONG_LANH', 11),
(3, '680', '60-80 gam/1 má', 'KHO_DONG_LANH', 12),
(3, '810', '80-100 gam/1 má', 'KHO_DONG_LANH', 13),
(3, '080', 'trên 80 gam/1 má', 'KHO_DONG_LANH', 14),
(3, '100', 'trên 100 gam/1 má', 'KHO_DONG_LANH', 15),
(3, '000', 'Không phân loại', 'KHO_DONG_LANH', 16);
