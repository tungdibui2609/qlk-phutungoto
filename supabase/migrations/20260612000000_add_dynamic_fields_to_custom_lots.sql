-- 1. Thêm cột custom_values vào bảng production_custom_lots để chứa thông tin động
ALTER TABLE public.production_custom_lots 
ADD COLUMN IF NOT EXISTS custom_values JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.production_custom_lots.custom_values IS 'Lưu trữ các giá trị của các trường thông tin động dạng JSONB (Key-Value)';

-- 2. Tạo bảng cấu hình các trường động cho từng phân hệ kho
CREATE TABLE IF NOT EXISTS public.production_custom_field_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_code VARCHAR(50) NOT NULL, -- Cô lập dữ liệu theo phân hệ kho
    lot_type VARCHAR(50) NOT NULL, -- 'semi_finished' hoặc 'finished'
    fields JSONB DEFAULT '[]'::jsonb, -- Lưu trữ danh sách các trường: [{ id, name, type, required, options }]
    company_id UUID, -- Bảo mật đa khách hàng
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (system_code, lot_type)
);

-- Thêm mô tả cho bảng và cột
COMMENT ON TABLE public.production_custom_field_configs IS 'Lưu cấu hình trường động (custom fields) cho các lô hàng tự khai báo';
COMMENT ON COLUMN public.production_custom_field_configs.fields IS 'Danh sách các trường động: [{id, name, type, required, options}]';

-- 3. Tạo index tăng tốc truy vấn theo phân hệ và loại lô
CREATE INDEX IF NOT EXISTS idx_production_custom_field_configs_sys_type 
ON public.production_custom_field_configs(system_code, lot_type);

-- 4. Kích hoạt Row Level Security (RLS)
ALTER TABLE public.production_custom_field_configs ENABLE ROW LEVEL SECURITY;

-- 5. Tạo các chính sách bảo mật cho bảng cấu hình trường động
CREATE POLICY "Allow authenticated users access to production_custom_field_configs" 
ON public.production_custom_field_configs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
