-- Thêm cột production_type vào bảng productions
ALTER TABLE productions ADD COLUMN IF NOT EXISTS production_type text DEFAULT 'NEW';

-- Tạo bảng production_inputs để lưu trữ hàng hóa mang từ kho vào sản xuất
CREATE TABLE IF NOT EXISTS production_inputs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    production_id uuid REFERENCES productions(id) ON DELETE CASCADE,
    lot_id uuid REFERENCES lots(id) ON DELETE SET NULL,
    lot_item_id uuid REFERENCES lot_items(id) ON DELETE SET NULL,
    product_id uuid REFERENCES products(id),
    quantity numeric NOT NULL,
    unit text,
    weight_kg numeric, -- Trọng lượng quy đổi để tính hao hụt
    system_code text, -- Để lọc theo phân hệ kho (DRY, FROZEN, v.v.)
    created_at timestamp with time zone DEFAULT now()
);

-- Index để truy vấn nhanh theo lệnh sản xuất
CREATE INDEX IF NOT EXISTS idx_production_inputs_production_id ON production_inputs(production_id);
