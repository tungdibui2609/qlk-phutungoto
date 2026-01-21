-- Add sort_order column to systems table
ALTER TABLE systems
ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Update existing systems to have some order based on creation (optional)
-- UPDATE systems SET sort_order = ... (Manual update later or default is fine)

COMMENT ON COLUMN systems.sort_order IS 'Order of display for systems (ascending)';
