-- 1. Create 'systems' table
CREATE TABLE IF NOT EXISTS systems (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT, -- Lucide icon name
    bg_color_class TEXT, -- For UI styling locally if needed, or we fetch from DB
    text_color_class TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert default systems
INSERT INTO systems (code, name, bg_color_class, text_color_class) VALUES
('FROZEN', 'Kho Đông Lạnh', 'bg-blue-600', 'text-blue-100'),
('PACKAGING', 'Kho Bao Bì', 'bg-yellow-600', 'text-yellow-100'),
('MATERIAL', 'Kho Nguyên Liệu', 'bg-green-600', 'text-green-100'),
('GENERAL', 'Tổng Hợp', 'bg-gray-600', 'text-gray-100')
ON CONFLICT (code) DO NOTHING;

-- 3. Function to convert system_type enum to text and add FK
DO $$ 
DECLARE 
    tbl TEXT;
    tables TEXT[] := ARRAY['branches', 'products', 'suppliers', 'customers', 'inbound_orders', 'outbound_orders', 'categories', 'zones', 'positions'];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        -- Execute dynamic SQL to alter table
        EXECUTE format('ALTER TABLE %I ALTER COLUMN system_type DROP DEFAULT', tbl);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN system_type TYPE TEXT USING system_type::TEXT', tbl);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN system_type SET DEFAULT ''FROZEN''', tbl);
        
        -- Add Foreign Key constraint if not exists
        BEGIN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT fk_%I_system_type FOREIGN KEY (system_type) REFERENCES systems(code) ON UPDATE CASCADE', tbl, tbl);
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END LOOP;
END $$;

-- 4. Drop the old enum type (Optional, safe to keep but better to clean up)
DROP TYPE IF EXISTS system_type_enum CASCADE;
