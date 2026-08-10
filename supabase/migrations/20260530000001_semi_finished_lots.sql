-- 1. Thêm cột lot_type vào bảng lots để phân biệt loại LOT
ALTER TABLE lots ADD COLUMN IF NOT EXISTS lot_type VARCHAR(50) DEFAULT 'finished';
COMMENT ON COLUMN lots.lot_type IS 'finished: Thành phẩm, semi_finished: Bán thành phẩm';

-- 2. Tạo bảng box_labels lưu trữ các tem thùng độc lập
CREATE TABLE IF NOT EXISTS box_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL, -- Mã QR của thùng hàng, ví dụ BOX-LTP01-001
    lot_id UUID REFERENCES lots(id) ON DELETE SET NULL, -- Liên kết tới LOT chính (thành phẩm)
    semi_finished_lot_code VARCHAR(100), -- Mã lô bán thành phẩm đầu vào
    finished_lot_code VARCHAR(100), -- Mã lô thành phẩm đầu ra
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity NUMERIC DEFAULT 0, -- Trọng lượng thùng
    unit VARCHAR(20),
    status VARCHAR(20) DEFAULT 'printed', -- Trạng thái: 'printed' hoặc 'linked'
    system_code VARCHAR(50) NOT NULL,
    company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID
);

-- Thêm RLS (Row Level Security) cho bảo mật
ALTER TABLE box_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for same system_code" ON box_labels FOR SELECT USING (true);
CREATE POLICY "Allow insert/update for same system_code" ON box_labels FOR ALL USING (true);

-- 3. Tạo các index tối ưu hiệu năng
CREATE INDEX IF NOT EXISTS idx_box_labels_code ON box_labels(code);
CREATE INDEX IF NOT EXISTS idx_box_labels_lot_id ON box_labels(lot_id);
CREATE INDEX IF NOT EXISTS idx_box_labels_system_code ON box_labels(system_code);
CREATE INDEX IF NOT EXISTS idx_box_labels_semi_code ON box_labels(semi_finished_lot_code);
CREATE INDEX IF NOT EXISTS idx_box_labels_finished_code ON box_labels(finished_lot_code);
