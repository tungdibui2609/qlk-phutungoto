-- ============================================
-- MIGRATION: Bảng Locations (Vị trí trong kho)
-- Chạy trong Supabase SQL Editor
-- ============================================

-- Thêm các cột còn thiếu vào bảng locations
ALTER TABLE locations ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'bin';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES locations(id) ON DELETE CASCADE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 0;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS current_quantity INTEGER DEFAULT 0;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS notes TEXT;

-- Cập nhật giá trị mặc định cho name nếu bị null
UPDATE locations SET name = code WHERE name IS NULL;

-- Tạo indexes
CREATE INDEX IF NOT EXISTS idx_locations_warehouse ON locations(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(type);
CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code);

-- Done!
SELECT 'Locations table updated!' as status;
