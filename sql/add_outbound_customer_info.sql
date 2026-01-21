-- Add customer_address and customer_phone columns to outbound_orders table
ALTER TABLE outbound_orders
ADD COLUMN customer_address TEXT,
ADD COLUMN customer_phone TEXT;
