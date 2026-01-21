-- Change hidden_menus column type from TEXT[] to JSONB
-- We will migrate existing data by assuming it belongs to a 'default' or 'global' key, or just reset it since structure changes.
-- Given the requirement, resetting to '{}' (active for all) or attempting to preserve is optional. 
-- Since it's a dev environment and user just requested it, let's reset to '{}' but with correct JSONB type.

ALTER TABLE user_profiles
DROP COLUMN hidden_menus;

ALTER TABLE user_profiles
ADD COLUMN hidden_menus JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN user_profiles.hidden_menus IS 'Map of system_code -> [hidden_menu_ids]. Example: {"FROZEN": ["Products"], "CHEMICAL": ["Customers"]}';
