-- Create order_types table
CREATE TABLE IF NOT EXISTS order_types (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('inbound', 'outbound', 'both')),
    description TEXT,
    system_code TEXT REFERENCES systems(code) ON DELETE CASCADE, -- Optional: link to system if needed, default null for global
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE order_types ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read access" ON order_types FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert" ON order_types FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update" ON order_types FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete" ON order_types FOR DELETE USING (auth.role() = 'authenticated');

-- Indexes
CREATE UNIQUE INDEX idx_order_types_code ON order_types(code);
