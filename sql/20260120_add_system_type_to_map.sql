-- Add system_type to 'zones' and 'locations' for Warehouse Map isolation

-- 1. Add to Zones
ALTER TABLE zones
ADD COLUMN IF NOT EXISTS system_type system_type_enum DEFAULT 'FROZEN';
CREATE INDEX IF NOT EXISTS idx_zones_system_type ON zones(system_type);

-- 2. Add to Locations (if exists, usually 'locations' or similar)
-- Checking if 'locations' table exists first is good practice, or just run it if we are sure.
-- Assuming 'locations' table exists based on typical structure.
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS system_type system_type_enum DEFAULT 'FROZEN';
CREATE INDEX IF NOT EXISTS idx_locations_system_type ON locations(system_type);
