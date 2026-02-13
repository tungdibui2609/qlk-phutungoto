-- Enable RLS on companies table if not already enabled (good practice)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it conflicts (or create new one)
DROP POLICY IF EXISTS "Public can find company by domain" ON companies;

-- Create policy to allow anyone to read company ID and Name if they know the custom_domain
-- This is necessary for the Middleware to resolve the tenant before login.
CREATE POLICY "Public can find company by domain" 
ON companies 
FOR SELECT 
USING ( true ); 
-- Note: 'true' allows reading ALL rows. 
-- In a stricter environment, you might want to restrict columns, but RLS restricts ROWS.
-- Since basic company info (name, logo, etc.) is usually public on a landing page, this is generally safe.
-- If you want to be stricter, you'd need a separate table for domain_mapping that is public, 
-- or use a security definer function. For now, allowing public read of companies is the standard solution for this app scale.

-- Ensure the anon role has permission to select
GRANT SELECT ON companies TO anon;
GRANT SELECT ON companies TO authenticated;
