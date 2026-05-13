-- Tạo bảng bàn giao hàng hóa (Handover Records)
-- Module: Bàn giao - Quản lý nhận và giao hàng hóa trực tiếp không cần sản phẩm/đơn vị

CREATE TABLE IF NOT EXISTS public.handover_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    system_code TEXT NOT NULL,
    company_id UUID,
    item_name TEXT NOT NULL, -- Tên hàng hóa nhập trực tiếp (VD: Bóng đèn, Dây điện...)
    quantity INTEGER NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'Cái', -- Đơn vị tính đơn giản (VD: Cái, Cuộn, Bộ...)
    from_department TEXT, -- Bộ phận giao (VD: Thu mua, Nhà cung cấp...)
    to_department TEXT, -- Bộ phận nhận (VD: Kho, Sản xuất...)
    direction TEXT NOT NULL DEFAULT 'inbound', -- 'inbound' = Nhận vào, 'outbound' = Giao đi
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'cancelled'
    notes TEXT, -- Ghi chú thêm
    received_by TEXT, -- Người nhận hàng
    handed_by TEXT, -- Người giao hàng
    related_record_id UUID REFERENCES public.handover_records(id), -- Liên kết với bản ghi gốc khi giao đi
    created_by UUID REFERENCES auth.users(id),
    created_by_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_handover_records_system_code ON public.handover_records(system_code);
CREATE INDEX IF NOT EXISTS idx_handover_records_company_id ON public.handover_records(company_id);
CREATE INDEX IF NOT EXISTS idx_handover_records_direction ON public.handover_records(direction);
CREATE INDEX IF NOT EXISTS idx_handover_records_status ON public.handover_records(status);
CREATE INDEX IF NOT EXISTS idx_handover_records_related ON public.handover_records(related_record_id);
CREATE INDEX IF NOT EXISTS idx_handover_records_created_at ON public.handover_records(created_at DESC);

-- Enable RLS
ALTER TABLE public.handover_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Người dùng trong cùng company có thể xem bản ghi
CREATE POLICY "Users can view handover records in their company" ON public.handover_records
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Người dùng đã đăng nhập có thể tạo bản ghi
CREATE POLICY "Users can create handover records" ON public.handover_records
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Người dùng có thể cập nhật bản ghi trong company của họ
CREATE POLICY "Users can update handover records" ON public.handover_records
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Người dùng có thể xóa bản ghi trong company của họ
CREATE POLICY "Users can delete handover records" ON public.handover_records
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_handover_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_handover_updated_at
    BEFORE UPDATE ON public.handover_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_handover_updated_at();

-- Seed module vào bảng app_modules
INSERT INTO public.app_modules (id, name, description, category, is_basic) VALUES
('handover', 'Bàn giao hàng hóa', 'Quản lý nhận và giao hàng hóa trực tiếp giữa các bộ phận, không cần tạo sản phẩm/đơn vị.', 'utility', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_basic = EXCLUDED.is_basic;