-- 1. Unlink categories from existing products
UPDATE products SET category_id = NULL;

-- 2. Delete all existing categories
DELETE FROM categories;

-- 3. Drop column if exists (to avoid "already exists" error)
ALTER TABLE categories DROP COLUMN IF EXISTS system_type;
-- Also drop 'slug' as requested
ALTER TABLE categories DROP COLUMN IF EXISTS slug;

-- 4. Add system_type column freshly with strict constraint
ALTER TABLE categories 
ADD COLUMN system_type text NOT NULL REFERENCES systems(code);
