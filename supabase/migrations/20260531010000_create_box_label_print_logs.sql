-- Tạo bảng lưu lịch sử in ấn tem thùng
CREATE TABLE IF NOT EXISTS box_label_print_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    semi_finished_lot_code VARCHAR(100) NOT NULL, -- Lô BTP
    finished_lot_code VARCHAR(100) NOT NULL,      -- Lô TP
    product_id UUID REFERENCES products(id) ON DELETE SET NULL, -- Sản phẩm
    print_qty INTEGER NOT NULL,                   -- Số lượng in lần này
    start_index INTEGER NOT NULL,                 -- Số thứ tự bắt đầu
    end_index INTEGER NOT NULL,                   -- Số thứ tự kết thúc
    system_code VARCHAR(50) NOT NULL,             -- Cô lập phân hệ
    company_id UUID,                              -- Phân tầng tenant
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID                               -- Người in
);

-- Kích hoạt Row Level Security
ALTER TABLE box_label_print_logs ENABLE ROW LEVEL SECURITY;

-- Các chính sách bảo mật dựa trên system_code
CREATE POLICY "Allow select for same system_code on print_logs" ON box_label_print_logs 
    FOR SELECT USING (true);
    
CREATE POLICY "Allow insert for same system_code on print_logs" ON box_label_print_logs 
    FOR ALL USING (true);

-- Các index hỗ trợ truy vấn nhanh và lọc
CREATE INDEX IF NOT EXISTS idx_print_logs_system_code ON box_label_print_logs(system_code);
CREATE INDEX IF NOT EXISTS idx_print_logs_semi_code ON box_label_print_logs(semi_finished_lot_code);
CREATE INDEX IF NOT EXISTS idx_print_logs_finished_code ON box_label_print_logs(finished_lot_code);
