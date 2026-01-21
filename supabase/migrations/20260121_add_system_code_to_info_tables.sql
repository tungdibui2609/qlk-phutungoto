-- Migration: Add system_code to suppliers, vehicles, and customers tables
-- Created: 2026-01-21

-- Add system_code column to suppliers table
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS system_code TEXT REFERENCES systems(code);

-- Add system_code column to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS system_code TEXT REFERENCES systems(code);

-- Add system_code column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS system_code TEXT REFERENCES systems(code);

-- Update existing records to assign to FROZEN system
UPDATE suppliers SET system_code = 'FROZEN' WHERE system_code IS NULL;
UPDATE vehicles SET system_code = 'FROZEN' WHERE system_code IS NULL;
UPDATE customers SET system_code = 'FROZEN' WHERE system_code IS NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_suppliers_system_code ON suppliers(system_code);
CREATE INDEX IF NOT EXISTS idx_vehicles_system_code ON vehicles(system_code);
CREATE INDEX IF NOT EXISTS idx_customers_system_code ON customers(system_code);
