-- Migration: Add system_code to products table
-- Created: 2026-01-21

-- Add system_code column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS system_code TEXT REFERENCES systems(code);

-- Update existing products to assign to FROZEN system
UPDATE products 
SET system_code = 'FROZEN' 
WHERE system_code IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_products_system_code 
ON products(system_code);
