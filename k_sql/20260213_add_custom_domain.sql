-- Add custom_domain column to companies table
ALTER TABLE companies 
ADD COLUMN custom_domain TEXT UNIQUE;

-- Add index for performance in lookup
CREATE INDEX idx_companies_custom_domain ON companies(custom_domain);

-- Example usage:
-- UPDATE companies SET custom_domain = 'khachhang.com' WHERE code = 'CTY_A';
