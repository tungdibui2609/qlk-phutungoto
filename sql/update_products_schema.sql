-- Add description and price columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS price decimal(12, 2) DEFAULT 0;

-- Refresh schema cache if needed (Supabase usually handles this)
