-- Add image_url column to inbound_orders table
ALTER TABLE inbound_orders 
ADD COLUMN IF NOT EXISTS image_url text;

-- Add image_url column to outbound_orders table
ALTER TABLE outbound_orders 
ADD COLUMN IF NOT EXISTS image_url text;

-- Add comment to explain the column
COMMENT ON COLUMN inbound_orders.image_url IS 'URL of the uploaded invoice/document image';
COMMENT ON COLUMN outbound_orders.image_url IS 'URL of the uploaded invoice/document image';
