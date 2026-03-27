-- Thêm liên kết từ Lệnh sản xuất (Productions) sang Lô Nguyên liệu tươi

ALTER TABLE public.productions
ADD COLUMN IF NOT EXISTS fresh_material_batch_id UUID REFERENCES public.fresh_material_batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS fresh_material_stage_id UUID REFERENCES public.fresh_material_stages(id) ON DELETE SET NULL;

-- Thêm comment mô tả
COMMENT ON COLUMN public.productions.fresh_material_batch_id IS 'Liên kết trực tiếp đến một lô nguyên liệu tươi';
COMMENT ON COLUMN public.productions.fresh_material_stage_id IS 'Giai đoạn cụ thể của lô nguyên liệu tươi được dùng làm đầu vào';

-- Index để truy vấn nhanh
CREATE INDEX IF NOT EXISTS idx_productions_fm_batch ON public.productions(fresh_material_batch_id);
CREATE INDEX IF NOT EXISTS idx_productions_fm_stage ON public.productions(fresh_material_stage_id);
