-- Migration Step 1: Add module columns to systems table
-- Run this FIRST before dropping system_configs

-- Add new columns to systems table if they don't exist
ALTER TABLE systems ADD COLUMN IF NOT EXISTS inbound_modules text[] DEFAULT ARRAY[]::text[];
ALTER TABLE systems ADD COLUMN IF NOT EXISTS outbound_modules text[] DEFAULT ARRAY[]::text[];
ALTER TABLE systems ADD COLUMN IF NOT EXISTS dashboard_modules text[] DEFAULT ARRAY[]::text[];
ALTER TABLE systems ADD COLUMN IF NOT EXISTS lot_modules text[] DEFAULT ARRAY[]::text[];

-- Verify columns were added
DO $$
BEGIN
    RAISE NOTICE 'Step 1 complete: Module columns added to systems table.';
END $$;
