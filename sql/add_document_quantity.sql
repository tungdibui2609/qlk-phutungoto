-- Add document_quantity column to inbound_order_items
ALTER TABLE inbound_order_items 
ADD COLUMN document_quantity numeric DEFAULT 0;

-- Add document_quantity column to outbound_order_items
ALTER TABLE outbound_order_items 
ADD COLUMN document_quantity numeric DEFAULT 0;
