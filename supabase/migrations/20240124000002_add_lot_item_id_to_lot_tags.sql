-- Add lot_item_id to lot_tags
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lot_tags' AND column_name = 'lot_item_id') THEN
        ALTER TABLE lot_tags ADD COLUMN lot_item_id UUID REFERENCES lot_items(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Migration: For existing tags, try to link to the first lot item of the lot
-- This assumes that for single-item lots (most common), the tag belongs to that item.
UPDATE lot_tags
SET lot_item_id = (
    SELECT id 
    FROM lot_items 
    WHERE lot_items.lot_id = lot_tags.lot_id 
    ORDER BY created_at ASC 
    LIMIT 1
)
WHERE lot_item_id IS NULL;

-- Update Unique Index
-- We want to allow a tag to be on Item A and Item B of the same Lot (same tag name, different item).
-- Old constraint was UNIQUE(lot_id, tag). This prevents same tag on different items if we don't include item_id.
-- We should drop old constraint and add new one: UNIQUE(lot_item_id, tag) where lot_item_id is NOT NULL.
-- But wait, what if lot_item_id IS NULL (whole lot tag)? We might support that too.
-- Let's use validation in API instead of strict hard constraint if complex, 
-- but UNIQUE(lot_item_id, tag) works if every tag MUST have an item.
-- Based on requirement "assign to product line", we enforce lot_item_id.

DO $$
BEGIN
    -- Drop old constraint if exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lot_tags_lot_id_tag_key') THEN
        ALTER TABLE lot_tags DROP CONSTRAINT lot_tags_lot_id_tag_key;
    END IF;
    
    -- Add new constraint. 
    -- If we enforce lot_item_id NOT NULL (after migration), we can just use (lot_item_id, tag).
    -- But let's check if migration succeeded for all rows first.
    -- Safety: Only add constraint if we decide to enforce. 
    -- Let's stick to unique per item.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lot_tags_lot_item_id_tag_key') THEN
         ALTER TABLE lot_tags ADD CONSTRAINT lot_tags_lot_item_id_tag_key UNIQUE (lot_item_id, tag);
    END IF;
END $$;
