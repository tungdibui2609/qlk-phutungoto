-- 1. Thêm cột company_id vào bảng positions
ALTER TABLE positions ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- 2. Cập nhật dữ liệu cũ dựa trên quan hệ với zones (vì zones đã có company_id)
UPDATE positions p
SET company_id = z.company_id
FROM zone_positions zp
JOIN zones z ON zp.zone_id = z.id
WHERE zp.position_id = p.id
AND p.company_id IS NULL;

-- 3. [Tùy chọn] Nếu có vị trí nào chưa thuộc zone, có thể gán mặc định (ví dụ công ty hệ thống) hoặc để NULL
-- Đề xuất: Nên kiểm tra và gán thủ công nếu dữ liệu quan trọng.

-- 4. Cấu hình Row Level Security (RLS) để cô lập dữ liệu
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

-- Policy cho xem dữ liệu
DROP POLICY IF EXISTS "Users can view their company positions" ON positions;
CREATE POLICY "Users can view their company positions" ON positions
FOR SELECT USING (
  company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
);

-- Policy cho thêm dữ liệu
DROP POLICY IF EXISTS "Users can insert their company positions" ON positions;
CREATE POLICY "Users can insert their company positions" ON positions
FOR INSERT WITH CHECK (
  company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
);

-- Policy cho cập nhật dữ liệu
DROP POLICY IF EXISTS "Users can update their company positions" ON positions;
CREATE POLICY "Users can update their company positions" ON positions
FOR UPDATE USING (
  company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
);

-- Policy cho xóa dữ liệu
DROP POLICY IF EXISTS "Users can delete their company positions" ON positions;
CREATE POLICY "Users can delete their company positions" ON positions
FOR DELETE USING (
  company_id = (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid
);
