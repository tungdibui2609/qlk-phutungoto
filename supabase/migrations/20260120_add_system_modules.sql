-- 1. Add 'modules' column to 'systems' table to store enabled features
-- Default is empty JSON array
ALTER TABLE systems 
ADD COLUMN modules jsonb DEFAULT '[]'::jsonb;

-- 2. Add 'specifications' column to 'products' table to store dynamic data
-- Default is empty JSON object
ALTER TABLE products 
ADD COLUMN specifications jsonb DEFAULT '{}'::jsonb;
