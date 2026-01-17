-- Add new columns to lots table
ALTER TABLE lots 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id),
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id),
ADD COLUMN IF NOT EXISTS inbound_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS batch_code TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_lots_product_id ON lots(product_id);
CREATE INDEX IF NOT EXISTS idx_lots_supplier_id ON lots(supplier_id);
