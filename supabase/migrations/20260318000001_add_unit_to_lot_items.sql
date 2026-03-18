-- Add unit column to lot_items to support different units per lot item
ALTER TABLE lot_items ADD COLUMN IF NOT EXISTS unit text;

-- Backfill from products
UPDATE lot_items li
SET unit = p.unit
FROM products p
WHERE li.product_id = p.id AND li.unit IS NULL;
