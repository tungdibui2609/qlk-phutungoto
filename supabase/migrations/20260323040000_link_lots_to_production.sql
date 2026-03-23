-- Add production_id to lots table to link with internal production orders
ALTER TABLE public.lots
ADD COLUMN production_id UUID REFERENCES public.productions(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.lots.production_id IS 'Liên kết với lệnh sản xuất nội bộ từ module Sản xuất';
