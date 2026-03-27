-- Add daily_seq column to lots table to support STT-based matching
ALTER TABLE public.lots ADD COLUMN IF NOT EXISTS daily_seq INTEGER;

-- Add a comment for documentation
COMMENT ON COLUMN public.lots.daily_seq IS 'Số thứ tự của LOT trong ngày (STT), dùng để khớp dữ liệu trên Mobile';

-- Create an index for performance when matching by date and STT
CREATE INDEX IF NOT EXISTS idx_lots_date_seq ON public.lots (inbound_date, daily_seq) WHERE daily_seq IS NOT NULL;
