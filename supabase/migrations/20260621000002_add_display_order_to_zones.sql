-- Add display_order to zones (synced from production)
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
