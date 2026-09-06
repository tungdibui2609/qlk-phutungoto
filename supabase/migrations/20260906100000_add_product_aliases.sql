-- Add aliases column to products table for quick search / abbreviation lookup
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS aliases TEXT;

-- Create index for faster search if needed
CREATE INDEX IF NOT EXISTS idx_products_aliases ON public.products(aliases);
