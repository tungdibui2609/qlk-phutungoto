-- Add blocked_routes column to user_profiles table
ALTER TABLE user_profiles
ADD COLUMN blocked_routes TEXT[] DEFAULT NULL;

COMMENT ON COLUMN user_profiles.blocked_routes IS 'List of route paths that the user is explicitly blocked from accessing';
