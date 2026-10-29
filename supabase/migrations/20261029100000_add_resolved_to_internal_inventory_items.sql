ALTER TABLE public.internal_inventory_items ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false;
