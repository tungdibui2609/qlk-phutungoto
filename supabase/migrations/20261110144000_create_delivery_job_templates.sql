-- Tạo bảng delivery_job_templates lưu trữ danh sách công việc mẫu cho Bàn Số Liệu & Giao nhận
CREATE TABLE IF NOT EXISTS public.delivery_job_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    system_code TEXT NOT NULL DEFAULT 'COLD',
    name TEXT NOT NULL,
    notes TEXT,
    pinned_product_ids JSONB DEFAULT '[]'::jsonb,
    order_index INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_delivery_job_templates_system ON public.delivery_job_templates(system_code);
CREATE INDEX IF NOT EXISTS idx_delivery_job_templates_company ON public.delivery_job_templates(company_id);

-- Bật Row Level Security (RLS)
ALTER TABLE public.delivery_job_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'delivery_job_templates' AND policyname = 'Enable all access for delivery_job_templates'
    ) THEN
        CREATE POLICY "Enable all access for delivery_job_templates"
        ON public.delivery_job_templates
        FOR ALL
        TO authenticated, anon
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- Thêm dữ liệu mẫu khởi tạo (nếu chưa có)
INSERT INTO public.delivery_job_templates (system_code, name, notes, pinned_product_ids, order_index)
SELECT 'COLD', 'Đóng gói sầu riêng xuất khẩu', 'Tổ đóng gói - Xưởng sơ chế', '[]'::jsonb, 1
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_job_templates WHERE name = 'Đóng gói sầu riêng xuất khẩu');

INSERT INTO public.delivery_job_templates (system_code, name, notes, pinned_product_ids, order_index)
SELECT 'COLD', 'Rút ruột sầu riêng', 'Khu vực tách múi', '[]'::jsonb, 2
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_job_templates WHERE name = 'Rút ruột sầu riêng');

INSERT INTO public.delivery_job_templates (system_code, name, notes, pinned_product_ids, order_index)
SELECT 'COLD', 'Sơ chế mít', 'Xưởng sơ chế mít', '[]'::jsonb, 3
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_job_templates WHERE name = 'Sơ chế mít');

INSERT INTO public.delivery_job_templates (system_code, name, notes, pinned_product_ids, order_index)
SELECT 'COLD', 'Kiểm hàng container', 'Cửa kho xuất cont', '[]'::jsonb, 4
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_job_templates WHERE name = 'Kiểm hàng container');

INSERT INTO public.delivery_job_templates (system_code, name, notes, pinned_product_ids, order_index)
SELECT 'COLD', 'Bốc xếp xưởng 2', 'Tổ bốc xếp', '[]'::jsonb, 5
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_job_templates WHERE name = 'Bốc xếp xưởng 2');

