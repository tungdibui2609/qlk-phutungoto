-- Create inbound_orders table
CREATE TABLE IF NOT EXISTS inbound_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE, -- e.g. PNK-20231025-01
    type TEXT DEFAULT 'Purchase', -- Nhập mua, Nhập trả, etc.
    status TEXT DEFAULT 'Pending', -- Pending, Completed, Cancelled
    warehouse_name TEXT, -- Store name directly if no strict warehouse table
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    description TEXT
);

-- Create inbound_order_items table
CREATE TABLE IF NOT EXISTS inbound_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES inbound_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT, -- Fallback if product deleted
    unit TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * price) STORED,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create outbound_orders table
CREATE TABLE IF NOT EXISTS outbound_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE, -- e.g. PXK-20231025-01
    type TEXT DEFAULT 'Sale', -- Xuất bán, Xuất hủy, etc.
    status TEXT DEFAULT 'Pending', -- Pending, Completed, Cancelled
    warehouse_name TEXT,
    customer_name TEXT, -- Or customer_id if you have customers table
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    description TEXT
);

-- Create outbound_order_items table
CREATE TABLE IF NOT EXISTS outbound_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES outbound_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT,
    unit TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    price DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) GENERATED ALWAYS AS (quantity * price) STORED,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE inbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_order_items ENABLE ROW LEVEL SECURITY;

-- Policies for inbound_orders
CREATE POLICY "Enable read access for all users" ON inbound_orders FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON inbound_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON inbound_orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete access for authenticated users" ON inbound_orders FOR DELETE USING (auth.role() = 'authenticated');

-- Policies for inbound_order_items
CREATE POLICY "Enable read access for all users" ON inbound_order_items FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON inbound_order_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON inbound_order_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete access for authenticated users" ON inbound_order_items FOR DELETE USING (auth.role() = 'authenticated');

-- Policies for outbound_orders
CREATE POLICY "Enable read access for all users" ON outbound_orders FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON outbound_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON outbound_orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete access for authenticated users" ON outbound_orders FOR DELETE USING (auth.role() = 'authenticated');

-- Policies for outbound_order_items
CREATE POLICY "Enable read access for all users" ON outbound_order_items FOR SELECT USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON outbound_order_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON outbound_order_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete access for authenticated users" ON outbound_order_items FOR DELETE USING (auth.role() = 'authenticated');
