-- Add permissions column to user_profiles to allow direct permission assignment
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';

-- Comment explaining the change
COMMENT ON COLUMN user_profiles.permissions IS 'List of permission codes directly assigned to the user. Overrides or replaces role-based permissions.';
