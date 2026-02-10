-- Add columns to track manual LOT adjustment confirmation
ALTER TABLE inventory_checks
ADD COLUMN IF NOT EXISTS lot_adjusted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS lot_adjusted_by UUID REFERENCES auth.users(id);

COMMENT ON COLUMN inventory_checks.lot_adjusted_at IS 'Timestamp when the manager confirmed manual LOT adjustment';
COMMENT ON COLUMN inventory_checks.lot_adjusted_by IS 'User who confirmed the manual LOT adjustment';
