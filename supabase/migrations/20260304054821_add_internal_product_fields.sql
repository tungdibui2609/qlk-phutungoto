-- Add internal_code and internal_name columns to products table
ALTER TABLE products
ADD COLUMN internal_code VARCHAR(255),
ADD COLUMN internal_name VARCHAR(255);

-- Create a unique constraint on internal_code to prevent duplicates
ALTER TABLE products
ADD CONSTRAINT products_internal_code_key UNIQUE (internal_code);
