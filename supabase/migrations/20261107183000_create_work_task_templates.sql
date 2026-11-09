-- Tạo bảng work_task_templates (Thư viện công việc mẫu dùng chung hoặc theo phân hệ kho)
CREATE TABLE IF NOT EXISTS public.work_task_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    target_system_code TEXT NOT NULL DEFAULT 'ALL',
    target_system_name TEXT NOT NULL DEFAULT 'Dùng chung',
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Vận hành kho',
    default_priority TEXT NOT NULL DEFAULT 'normal' CHECK (default_priority IN ('urgent', 'important', 'normal')),
    description TEXT,
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_work_task_templates_company ON public.work_task_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_work_task_templates_system ON public.work_task_templates(target_system_code);

-- Bật Row Level Security (RLS)
ALTER TABLE public.work_task_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'work_task_templates' AND policyname = 'Enable all access for authenticated and anon users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated and anon users"
        ON public.work_task_templates
        FOR ALL
        TO authenticated, anon
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

