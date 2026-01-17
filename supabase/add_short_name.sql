-- Add short_name column to company_settings table
ALTER TABLE company_settings 
ADD COLUMN short_name TEXT;
