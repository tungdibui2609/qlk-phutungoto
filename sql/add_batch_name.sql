-- Add batch_name column to positions for grouping
ALTER TABLE positions ADD COLUMN IF NOT EXISTS batch_name VARCHAR(100);

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_positions_batch_name ON positions(batch_name);
