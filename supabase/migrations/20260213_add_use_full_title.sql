-- Add use_full_title column to zone_status_layouts table
ALTER TABLE zone_status_layouts 
ADD COLUMN IF NOT EXISTS use_full_title BOOLEAN DEFAULT false;

-- Update the comment for documentation (optional but good practice)
COMMENT ON COLUMN zone_status_layouts.use_full_title IS 'If true, display the full zone name in grouped view instead of code/short name.';
