-- Add hidden_menus column to user_profiles table to store array of hidden menu names
ALTER TABLE user_profiles
ADD COLUMN hidden_menus TEXT[] DEFAULT '{}';

COMMENT ON COLUMN user_profiles.hidden_menus IS 'List of menu names that the user wants to hide from the sidebar';
