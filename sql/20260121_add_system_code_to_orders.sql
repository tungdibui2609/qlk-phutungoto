-- Add system_code to inbound_orders
ALTER TABLE inbound_orders
ADD COLUMN IF NOT EXISTS system_code text DEFAULT 'FROZEN';

UPDATE inbound_orders
SET system_code = 'FROZEN'
WHERE system_code IS NULL;

-- Add system_code to outbound_orders
ALTER TABLE outbound_orders
ADD COLUMN IF NOT EXISTS system_code text DEFAULT 'FROZEN';

UPDATE outbound_orders
SET system_code = 'FROZEN'
WHERE system_code IS NULL;
