
-- Add config columns for order modules
ALTER TABLE system_configs
ADD COLUMN IF NOT EXISTS inbound_modules JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS outbound_modules JSONB DEFAULT '[]';

-- Comment on columns
COMMENT ON COLUMN system_configs.inbound_modules IS 'List of active inbound order module IDs';
COMMENT ON COLUMN system_configs.outbound_modules IS 'List of active outbound order module IDs';
