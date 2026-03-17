-- Add sort_order column to products table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sort_order') THEN
        ALTER TABLE public.products ADD COLUMN sort_order INTEGER;
    END IF;
END $$;
