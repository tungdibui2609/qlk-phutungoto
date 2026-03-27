-- Add raw material input fields to productions table
ALTER TABLE public.productions
ADD COLUMN IF NOT EXISTS input_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS input_quantity NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS input_unit TEXT;

COMMENT ON COLUMN public.productions.input_product_id IS 'Sản phẩm nguyên liệu đầu vào chính';
COMMENT ON COLUMN public.productions.input_quantity IS 'Số lượng nguyên liệu đầu vào';
COMMENT ON COLUMN public.productions.input_unit IS 'Đơn vị tính của nguyên liệu đầu vào';
