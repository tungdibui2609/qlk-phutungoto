-- Tạo bảng ca giao nhận delivery_shifts
-- Lưu lịch sử ca làm việc, thời gian mở/chốt ca và tổng kết đối chiếu cuối ca.

CREATE TABLE IF NOT EXISTS public.delivery_shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    system_code TEXT NOT NULL,
    company_id UUID,
    
    -- Trạng thái: 'open' (Đang hoạt động), 'closed' (Đã chốt)
    status TEXT NOT NULL DEFAULT 'open',
    
    -- Thông tin người mở ca
    opened_by UUID REFERENCES auth.users(id),
    opened_by_name TEXT,
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Thông tin người chốt ca
    closed_by UUID REFERENCES auth.users(id),
    closed_by_name TEXT,
    closed_at TIMESTAMP WITH TIME ZONE,
    
    -- Tổng kết số liệu giao nhận trong ca
    summary_data JSONB DEFAULT '{}'::jsonb,
    
    -- Ghi chú/Giao ban cuối ca
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index
CREATE INDEX IF NOT EXISTS idx_delivery_shifts_system_code ON public.delivery_shifts(system_code);
CREATE INDEX IF NOT EXISTS idx_delivery_shifts_company_id ON public.delivery_shifts(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_shifts_status ON public.delivery_shifts(status);

-- Enable RLS
ALTER TABLE public.delivery_shifts ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view shifts in their company" ON public.delivery_shifts;
CREATE POLICY "Users can view shifts in their company" ON public.delivery_shifts
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create shifts" ON public.delivery_shifts;
CREATE POLICY "Users can create shifts" ON public.delivery_shifts
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update shifts" ON public.delivery_shifts;
CREATE POLICY "Users can update shifts" ON public.delivery_shifts
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete shifts" ON public.delivery_shifts;
CREATE POLICY "Users can delete shifts" ON public.delivery_shifts
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_delivery_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_delivery_shifts_updated_at ON public.delivery_shifts;
CREATE TRIGGER set_delivery_shifts_updated_at
    BEFORE UPDATE ON public.delivery_shifts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_delivery_shifts_updated_at();

-- Enable Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'delivery_shifts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_shifts;
    END IF;
END $$;
