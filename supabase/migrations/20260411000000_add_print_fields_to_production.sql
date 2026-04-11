-- Migration: Add missing print fields to productions and production_lots
-- Date: 2026-04-11

-- 1. Bổ sung cho bảng productions (Lệnh sản xuất)
ALTER TABLE public.productions 
ADD COLUMN IF NOT EXISTS last_sheet_index INTEGER DEFAULT 0;

-- 2. Bổ sung cho bảng production_lots (Lô thuộc lệnh sản xuất)
ALTER TABLE public.production_lots 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_printed_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_printed_labels INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_printed_sheets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS damaged_printed_labels INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS damaged_printed_sheets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS damaged_print_logs JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_printed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS print_config JSONB DEFAULT '{}'::jsonb;

-- Comment mô tả các cột để dễ quản lý
COMMENT ON COLUMN public.productions.last_sheet_index IS 'STT tờ in A4 cuối cùng của toàn bộ lệnh sản xuất';
COMMENT ON COLUMN public.production_lots.product_id IS 'Liên kết trực tiếp tới sản phẩm để tối ưu truy vấn in';
COMMENT ON COLUMN public.production_lots.last_printed_index IS 'STT tem cuối cùng đã in của lô này';
COMMENT ON COLUMN public.production_lots.damaged_print_logs IS 'Nhật ký in bù tem/tờ hỏng (lý do, user, số lượng)';
COMMENT ON COLUMN public.production_lots.total_printed_labels IS 'Tổng số tem đạt đã in';
COMMENT ON COLUMN public.production_lots.total_printed_sheets IS 'Tổng số tờ A4 đạt đã in';
COMMENT ON COLUMN public.production_lots.print_config IS 'Cấu hình in tùy chỉnh cho từng lô (quy cách, khối lượng...)';
