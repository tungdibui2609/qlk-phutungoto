-- ============================================
-- Migration: Warehouse Infrastructure Rebuild
-- ============================================

-- Step 1: Drop old tables (optional - run if you want to clean up)
-- DROP TABLE IF EXISTS inventory CASCADE;
-- DROP TABLE IF EXISTS inventory_transactions CASCADE;
-- DROP TABLE IF EXISTS locations CASCADE;
-- DROP TABLE IF EXISTS warehouses CASCADE;

-- Step 2: Create new tables

-- Table: positions (Ô - vị trí cuối cùng để lưu hàng)
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) UNIQUE NOT NULL,  -- Mã ô, VD: "A-K3D4T5.PL1"
  display_order INT DEFAULT 0,         -- Thứ tự hiển thị trên lưới
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: zones (Khu cha - có thể lồng nhiều cấp)
CREATE TABLE IF NOT EXISTS zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,           -- Mã zone, VD: "Khu-A"
  name VARCHAR(255) NOT NULL,          -- Tên hiển thị
  parent_id UUID REFERENCES zones(id) ON DELETE SET NULL,  -- Zone cha
  level INT DEFAULT 0,                 -- Cấp độ (0 = gốc)
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: zone_positions (Gán position vào zone)
CREATE TABLE IF NOT EXISTS zone_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(position_id)  -- Mỗi position chỉ thuộc 1 zone trực tiếp
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_positions_code ON positions(code);
CREATE INDEX IF NOT EXISTS idx_zones_parent ON zones(parent_id);
CREATE INDEX IF NOT EXISTS idx_zone_positions_zone ON zone_positions(zone_id);
CREATE INDEX IF NOT EXISTS idx_zone_positions_position ON zone_positions(position_id);

-- Step 4: Enable RLS
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_positions ENABLE ROW LEVEL SECURITY;

-- Step 5: Create permissive policies (adjust as needed)
CREATE POLICY "Allow all for positions" ON positions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for zones" ON zones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for zone_positions" ON zone_positions FOR ALL USING (true) WITH CHECK (true);

-- Step 6: Update inventory table to use position_id instead of location_id
-- (Only run if you have data to migrate)
-- ALTER TABLE inventory DROP COLUMN IF EXISTS location_id;
-- ALTER TABLE inventory ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES positions(id);
