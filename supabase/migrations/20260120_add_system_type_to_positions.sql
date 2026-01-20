-- Add system_type to 'positions' table
ALTER TABLE positions
ADD COLUMN IF NOT EXISTS system_type system_type_enum DEFAULT 'FROZEN';

CREATE INDEX IF NOT EXISTS idx_positions_system_type ON positions(system_type);
