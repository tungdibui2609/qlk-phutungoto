-- Add supplier_address and supplier_phone columns to inbound_orders table
ALTER TABLE inbound_orders
ADD COLUMN supplier_address TEXT,
ADD COLUMN supplier_phone TEXT;
