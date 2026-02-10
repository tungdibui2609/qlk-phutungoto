-- Add lot_system_quantity to inventory_check_items to store physical inventory snapshot
ALTER TABLE inventory_check_items 
ADD COLUMN lot_system_quantity NUMERIC DEFAULT 0;

COMMENT ON COLUMN inventory_check_items.lot_system_quantity IS 'Snapshot of the total quantity across all lots (physical) at the time of audit creation.';
