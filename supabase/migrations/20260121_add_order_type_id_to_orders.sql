-- Add order_type_id to inbound_orders
ALTER TABLE inbound_orders
ADD COLUMN IF NOT EXISTS order_type_id TEXT REFERENCES order_types(id) ON DELETE SET NULL;

-- Add order_type_id to outbound_orders
ALTER TABLE outbound_orders
ADD COLUMN IF NOT EXISTS order_type_id TEXT REFERENCES order_types(id) ON DELETE SET NULL;

-- Index for better join performance
CREATE INDEX IF NOT EXISTS idx_inbound_orders_type ON inbound_orders(order_type_id);
CREATE INDEX IF NOT EXISTS idx_outbound_orders_type ON outbound_orders(order_type_id);

-- Explicitly remove system_code constraint if we want to rely on order_type to classify detailed flows, 
-- but system_code is still useful for high-level segregation (e.g. Frozen vs Material). 
-- So we keep system_code.
