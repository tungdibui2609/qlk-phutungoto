-- Tạo bảng phân ca giao nhận delivery_sub_shifts
-- Mỗi ca chính (delivery_shifts) có thể được chia thành nhiều phân ca (sub_shift).
-- Phân ca giúp đối chiếu, tổng kết số liệu giao nhận theo từng khoảng thời gian nhỏ trong ca.

CREATE TABLE IF NOT EXISTS public.delivery_sub_shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Liên kết tới ca chính, xóa ca chính sẽ xóa luôn các phân ca
    shift_id UUID NOT NULL REFERENCES public.delivery_shifts(id) ON DELETE CASCADE,
    
    system_code TEXT NOT NULL,
    company_id UUID,
    
    -- Số thứ tự phân ca trong ca chính (1, 2, 3, ...)
    sub_shift_number INT NOT NULL DEFAULT 1,
    
    -- Khoảng thời gian hoạt động của phân ca
    from_time TIMESTAMP WITH TIME ZONE NOT NULL,
    to_time TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Thông tin người chốt phân ca
    closed_by UUID REFERENCES auth.users(id),
    closed_by_name TEXT,
    
    -- Tổng kết số liệu giao nhận trong phân ca
    summary_data JSONB DEFAULT '{}'::jsonb,
    
    -- Ghi chú phân ca
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.delivery_sub_shifts IS 'Bảng phân ca giao nhận – chia nhỏ ca chính (delivery_shifts) thành các khoảng thời gian để đối chiếu và tổng kết số liệu giao nhận.';

-- Index
CREATE INDEX IF NOT EXISTS idx_delivery_sub_shifts_shift_id ON public.delivery_sub_shifts(shift_id);
CREATE INDEX IF NOT EXISTS idx_delivery_sub_shifts_system_code ON public.delivery_sub_shifts(system_code);
CREATE INDEX IF NOT EXISTS idx_delivery_sub_shifts_company_id ON public.delivery_sub_shifts(company_id);

-- Enable RLS
ALTER TABLE public.delivery_sub_shifts ENABLE ROW LEVEL SECURITY;

-- Policies (giống delivery_shifts, kiểm tra company_id khớp với profiles của user)
DROP POLICY IF EXISTS "Users can view sub_shifts in their company" ON public.delivery_sub_shifts;
CREATE POLICY "Users can view sub_shifts in their company" ON public.delivery_sub_shifts
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create sub_shifts" ON public.delivery_sub_shifts;
CREATE POLICY "Users can create sub_shifts" ON public.delivery_sub_shifts
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update sub_shifts" ON public.delivery_sub_shifts;
CREATE POLICY "Users can update sub_shifts" ON public.delivery_sub_shifts
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete sub_shifts" ON public.delivery_sub_shifts;
CREATE POLICY "Users can delete sub_shifts" ON public.delivery_sub_shifts
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_delivery_sub_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_delivery_sub_shifts_updated_at ON public.delivery_sub_shifts;
CREATE TRIGGER set_delivery_sub_shifts_updated_at
    BEFORE UPDATE ON public.delivery_sub_shifts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_delivery_sub_shifts_updated_at();

-- Enable Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'delivery_sub_shifts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_sub_shifts;
    END IF;
END $$;
