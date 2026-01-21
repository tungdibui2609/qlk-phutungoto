-- 1. Create enum for system types (if not exists)
DO $$ BEGIN
    CREATE TYPE system_type_enum AS ENUM ('FROZEN', 'PACKAGING', 'MATERIAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add system_type column to core tables

-- Branches (Thay cho Warehouses)
ALTER TABLE branches
ADD COLUMN IF NOT EXISTS system_type system_type_enum DEFAULT 'FROZEN';
CREATE INDEX IF NOT EXISTS idx_branches_system_type ON branches(system_type);

-- Products
ALTER TABLE products
ADD COLUMN IF NOT EXISTS system_type system_type_enum DEFAULT 'FROZEN';
CREATE INDEX IF NOT EXISTS idx_products_system_type ON products(system_type);

-- Suppliers
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS system_type system_type_enum DEFAULT 'FROZEN';
CREATE INDEX IF NOT EXISTS idx_suppliers_system_type ON suppliers(system_type);

-- Customers
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS system_type system_type_enum DEFAULT 'FROZEN';
CREATE INDEX IF NOT EXISTS idx_customers_system_type ON customers(system_type);

-- Inbound Orders
ALTER TABLE inbound_orders
ADD COLUMN IF NOT EXISTS system_type system_type_enum DEFAULT 'FROZEN';
CREATE INDEX IF NOT EXISTS idx_inbound_orders_system_type ON inbound_orders(system_type);

-- Outbound Orders
ALTER TABLE outbound_orders
ADD COLUMN IF NOT EXISTS system_type system_type_enum DEFAULT 'FROZEN';
CREATE INDEX IF NOT EXISTS idx_outbound_orders_system_type ON outbound_orders(system_type);

-- Categories (Danh mục cũng cần phân loại)
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS system_type system_type_enum DEFAULT 'FROZEN';
CREATE INDEX IF NOT EXISTS idx_categories_system_type ON categories(system_type);

-- 3. (Optional) Enable RLS on Products for demonstration
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Note: We are NOT adding it to 'inventory' or 'inventory_transactions' as they inherit via product_id or do not exist.
