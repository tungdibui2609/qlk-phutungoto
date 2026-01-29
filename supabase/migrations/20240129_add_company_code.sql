-- Add code column to company_settings
ALTER TABLE company_settings 
ADD COLUMN code TEXT;

-- Update existing records to have a code based on short_name or name
UPDATE company_settings 
SET code = LOWER(SUBSTRING(REGEXP_REPLACE(COALESCE(short_name, name), '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 6))
WHERE code IS NULL;

-- Make it unique and required (after populating)
CREATE UNIQUE INDEX idx_company_settings_code ON company_settings(code);
-- We won't add NOT NULL constraint yet to avoid breaking if update failed, but UI will enforce it.
