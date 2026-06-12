-- Thêm cột production_id liên kết bảng productions vào bảng box_labels
ALTER TABLE public.box_labels 
ADD COLUMN IF NOT EXISTS production_id UUID REFERENCES public.productions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.box_labels.production_id IS 'Liên kết tới Lệnh sản xuất (productions)';

-- Tạo index tăng tốc truy vấn cho cột mới
CREATE INDEX IF NOT EXISTS idx_box_labels_production_id ON public.box_labels(production_id);
