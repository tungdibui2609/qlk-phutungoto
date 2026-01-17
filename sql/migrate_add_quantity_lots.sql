-- Add quantity column to lots table
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0;
