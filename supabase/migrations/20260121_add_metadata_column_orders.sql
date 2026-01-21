-- Add metadata column to inbound_orders
ALTER TABLE inbound_orders
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add metadata column to outbound_orders
ALTER TABLE outbound_orders
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
