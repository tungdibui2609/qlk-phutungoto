-- Migration: Add unlocked_modules to companies table
-- This column will store the IDs of advanced modules that a company is licensed to use.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS unlocked_modules text[] DEFAULT ARRAY[]::text[];

-- Update RLS policies (if any) to ensure companies can see their own unlocked_modules
-- For standard users, this is usually already covered by their company_id match.
-- For Super Admin, we should ensure they can update this column.

DO $$
BEGIN
    RAISE NOTICE 'Added unlocked_modules column to companies table.';
END $$;
