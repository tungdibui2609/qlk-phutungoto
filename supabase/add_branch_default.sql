-- Add is_default column to branches table
ALTER TABLE branches 
ADD COLUMN is_default BOOLEAN DEFAULT false;

-- Create a function to ensure only one default branch exists
CREATE OR REPLACE FUNCTION ensure_single_default_branch()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE branches
        SET is_default = false
        WHERE id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_ensure_single_default_branch ON branches;
CREATE TRIGGER trigger_ensure_single_default_branch
BEFORE INSERT OR UPDATE OF is_default ON branches
FOR EACH ROW
WHEN (NEW.is_default = true)
EXECUTE FUNCTION ensure_single_default_branch();
