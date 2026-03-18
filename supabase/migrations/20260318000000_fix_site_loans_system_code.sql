-- Add system_code and order_id to site_loans
ALTER TABLE site_loans ADD COLUMN IF NOT EXISTS system_code text;
ALTER TABLE site_loans ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES outbound_orders(id);
