-- Add allowed_systems column to user_profiles
-- This stores which systems the user can access (e.g. ['FROZEN', 'PACKAGING'] or ['ALL'])
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS allowed_systems TEXT[] DEFAULT ARRAY['FROZEN']::TEXT[];

-- Comment on column
COMMENT ON COLUMN user_profiles.allowed_systems IS 'Array of system codes this user can access. Special value "ALL" means all systems.';
