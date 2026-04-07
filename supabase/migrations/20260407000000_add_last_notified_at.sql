-- Add last_notified_at column to products table to throttle stock alerts
ALTER TABLE products ADD COLUMN last_notified_at timestamp with time zone;

COMMENT ON COLUMN products.last_notified_at IS 'Last time an email alert was sent for this product reaching its min_stock_level';
