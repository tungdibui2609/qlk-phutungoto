-- Tạo bảng Nhật ký Giao nhận (Delivery Journal)
-- Module: Giao nhận - Quy trình khép kín giữa Kho và Sản xuất
-- Workflow: Kho gửi -> SX nhận -> SX hoàn thành gửi trả -> Kho nhận lại

CREATE TABLE IF NOT EXISTS public.delivery_journal (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    system_code TEXT NOT NULL,
    company_id UUID,
    
    -- Mã giao nhận tự sinh (VD: GN-20260517-0001)
    delivery_code TEXT,
    
    -- Thông tin giao từ Kho -> Sản xuất
    item_name TEXT NOT NULL,              -- Tên hàng/vật tư kho gửi
    quantity_sent NUMERIC NOT NULL DEFAULT 1, -- Số lượng kho gửi
    unit TEXT DEFAULT 'Cái',              -- Đơn vị tính
    
    from_department TEXT DEFAULT 'Kho',   -- Bộ phận gửi
    to_department TEXT DEFAULT 'Sản xuất', -- Bộ phận nhận
    
    -- Trạng thái workflow
    -- 'sent': Kho đã gửi, chờ SX xác nhận
    -- 'received_by_production': SX đã xác nhận nhận
    -- 'completed_by_production': SX đã hoàn thành và gửi trả kết quả
    -- 'received_by_warehouse': Kho đã nhận lại thành phẩm (hoàn tất)
    -- 'cancelled': Đã hủy
    status TEXT NOT NULL DEFAULT 'sent',
    
    -- Kết quả SX trả về
    result_item_name TEXT,                -- Tên thành phẩm SX làm ra
    result_quantity NUMERIC,              -- Số lượng thành phẩm
    result_unit TEXT,                     -- Đơn vị thành phẩm
    
    -- Ghi chú
    notes TEXT,
    
    -- Người thực hiện từng bước
    sent_by TEXT,                         -- Nhân viên kho gửi
    sent_by_name TEXT,                    -- Tên nhân viên kho gửi
    received_by_production TEXT,          -- Nhân viên SX nhận
    received_by_production_name TEXT,
    completed_by TEXT,                    -- Nhân viên SX hoàn thành
    completed_by_name TEXT,
    received_by_warehouse TEXT,           -- Nhân viên kho nhận lại
    received_by_warehouse_name TEXT,
    
    -- Timestamps cho từng bước
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    received_by_production_at TIMESTAMP WITH TIME ZONE,
    completed_by_production_at TIMESTAMP WITH TIME ZONE,
    received_by_warehouse_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_by_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_journal_system_code ON public.delivery_journal(system_code);
CREATE INDEX IF NOT EXISTS idx_delivery_journal_company_id ON public.delivery_journal(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_journal_status ON public.delivery_journal(status);
CREATE INDEX IF NOT EXISTS idx_delivery_journal_delivery_code ON public.delivery_journal(delivery_code);
CREATE INDEX IF NOT EXISTS idx_delivery_journal_created_at ON public.delivery_journal(created_at DESC);

-- Enable RLS
ALTER TABLE public.delivery_journal ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view delivery journal in their company" ON public.delivery_journal
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create delivery journal" ON public.delivery_journal
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update delivery journal" ON public.delivery_journal
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete delivery journal" ON public.delivery_journal
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_delivery_journal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_delivery_journal_updated_at
    BEFORE UPDATE ON public.delivery_journal
    FOR EACH ROW
    EXECUTE FUNCTION public.update_delivery_journal_updated_at();

-- Function: Tự sinh delivery_code
CREATE OR REPLACE FUNCTION public.generate_delivery_code()
RETURNS TRIGGER AS $$
DECLARE
    v_date TEXT;
    v_seq INT;
    v_prefix TEXT;
BEGIN
    v_date := to_char(NEW.created_at, 'YYYYMMDD');
    v_prefix := 'GN-' || v_date || '-';
    
    SELECT COUNT(*) + 1 INTO v_seq
    FROM public.delivery_journal
    WHERE delivery_code LIKE v_prefix || '%'
    AND system_code = NEW.system_code;
    
    NEW.delivery_code := v_prefix || LPAD(v_seq::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_delivery_code_trigger
    BEFORE INSERT ON public.delivery_journal
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_delivery_code();

-- Seed module vào bảng app_modules
INSERT INTO public.app_modules (id, name, description, category, is_basic) VALUES
('delivery_journal', 'Giao nhận', 'Nhật ký giao nhận giữa Kho và Sản xuất: Kho gửi vật tư, SX nhận và hoàn trả thành phẩm. Đồng bộ real-time.', 'utility', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_basic = EXCLUDED.is_basic;

-- Enable Realtime cho bảng (Supabase)
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_journal;