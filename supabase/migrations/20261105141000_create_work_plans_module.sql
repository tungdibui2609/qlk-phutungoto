-- 1. Đăng ký module "Kế hoạch Công việc & Đánh giá" (work_plan) vào danh mục module trung tâm
INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES (
    'work_plan',
    'Kế hoạch Công việc & Đánh giá',
    'Lập bảng kế hoạch làm việc hàng ngày, giao việc cho nhân viên/tổ đội, chấm điểm & đánh giá chất lượng cuối ngày, chuyển việc tồn đọng và xuất báo cáo Zalo/Excel.',
    'utility',
    true
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_basic = EXCLUDED.is_basic;

-- Tự động bật utility module work_plan cho các phân hệ đã bật shift_tasks để thuận tiện sử dụng ngay
UPDATE public.systems
SET modules = jsonb_set(
    COALESCE(modules, '{}'::jsonb),
    '{utility_modules}',
    (
        SELECT jsonb_agg(DISTINCT elem)
        FROM jsonb_array_elements_text(
            COALESCE(modules->'utility_modules', '[]'::jsonb) || '["work_plan"]'::jsonb
        ) AS elem
    )
)
WHERE modules->'utility_modules' IS NOT NULL
  AND (modules->'utility_modules') @> '["shift_tasks"]'::jsonb;

-- 2. Tạo bảng work_plans (Phiếu Kế hoạch làm việc theo Ngày & Phân hệ)
CREATE TABLE IF NOT EXISTS public.work_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    system_code TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    plan_date DATE NOT NULL,
    shift_name TEXT NOT NULL DEFAULT 'Cả ngày',
    title TEXT NOT NULL,
    area_name TEXT,
    general_note TEXT,
    end_of_day_summary TEXT,
    status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('DRAFT', 'PLANNED', 'IN_PROGRESS', 'EVALUATED', 'LOCKED')),
    created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_by_name TEXT,
    evaluated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    evaluated_by_name TEXT,
    evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_work_plans_system_date ON public.work_plans(system_code, plan_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_plans_company_id ON public.work_plans(company_id);

-- 3. Tạo bảng work_plan_items (Chi tiết từng đầu việc 1, 2, 3... và kết quả đánh giá cuối ngày)
CREATE TABLE IF NOT EXISTS public.work_plan_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    plan_id UUID NOT NULL REFERENCES public.work_plans(id) ON DELETE CASCADE,
    system_code TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    plan_date DATE NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'Vận hành kho',
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'important', 'normal')),
    location_note TEXT,
    assignees JSONB NOT NULL DEFAULT '[]'::jsonb,
    images JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'partial', 'uncompleted', 'cancelled')),
    progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    rating TEXT CHECK (rating IN ('excellent', 'good', 'satisfactory', 'needs_improvement', 'poor') OR rating IS NULL),
    rating_stars INTEGER CHECK ((rating_stars >= 1 AND rating_stars <= 5) OR rating_stars IS NULL),
    evaluation_note TEXT,
    completion_images JSONB NOT NULL DEFAULT '[]'::jsonb,
    evaluated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    evaluated_by_name TEXT,
    evaluated_at TIMESTAMPTZ,
    carried_from_item_id UUID,
    carried_to_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_work_plan_items_plan_id ON public.work_plan_items(plan_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_work_plan_items_system_date ON public.work_plan_items(system_code, plan_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_plan_items_company_id ON public.work_plan_items(company_id);

-- 4. Bật RLS & Policies
ALTER TABLE public.work_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_plan_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'work_plans' AND policyname = 'Enable all access for authenticated and anon users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated and anon users"
        ON public.work_plans
        FOR ALL
        TO authenticated, anon
        USING (true)
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'work_plan_items' AND policyname = 'Enable all access for authenticated and anon users'
    ) THEN
        CREATE POLICY "Enable all access for authenticated and anon users"
        ON public.work_plan_items
        FOR ALL
        TO authenticated, anon
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- 5. Khởi tạo sẵn Kế hoạch mẫu ngày 05.11.2026 (theo ảnh thực tế của kho) nếu chưa có
DO $$
DECLARE
    v_plan_id UUID;
    v_company_id UUID;
BEGIN
    SELECT company_id INTO v_company_id FROM public.systems WHERE code = 'KHO_DONG_LANH' LIMIT 1;

    IF NOT EXISTS (SELECT 1 FROM public.work_plans WHERE system_code = 'KHO_DONG_LANH' AND plan_date = '2026-11-05') THEN
        INSERT INTO public.work_plans (system_code, company_id, plan_date, shift_name, title, status, created_by_name)
        VALUES ('KHO_DONG_LANH', v_company_id, '2026-11-05', 'Cả ngày', 'Kế hoạch làm việc kho ngày 05.11.2026', 'PLANNED', 'Quản lý kho')
        RETURNING id INTO v_plan_id;

        INSERT INTO public.work_plan_items (plan_id, system_code, company_id, plan_date, sort_order, content, category, priority, location_note, assignees, status, progress_percent)
        VALUES
        (v_plan_id, 'KHO_DONG_LANH', v_company_id, '2026-11-05', 1, 'Ướp đào tạo, hỗ trợ hướng dẫn Uy và Trôi chạy xe nâng xanh và xe nâng cao', 'Đào tạo & Hỗ trợ', 'normal', 'Khu xe nâng', '[{"name": "Uy", "type": "member"}, {"name": "Trôi", "type": "member"}]'::jsonb, 'pending', 0),
        (v_plan_id, 'KHO_DONG_LANH', v_company_id, '2026-11-05', 2, 'Hạ hàng, đưa hàng ra đai hàng C hạt chuẩn bị xuất cont', 'Xuất / Nhập cont', 'important', 'Sảnh C', '[]'::jsonb, 'pending', 0),
        (v_plan_id, 'KHO_DONG_LANH', v_company_id, '2026-11-05', 3, 'Vệ sinh dàn lạnh, quét tuyết và đập đá kho 1', 'Vệ sinh & 5S', 'normal', 'Kho 1', '[]'::jsonb, 'pending', 0),
        (v_plan_id, 'KHO_DONG_LANH', v_company_id, '2026-11-05', 4, 'Đưa hàng ra cho sx làm hàng khay', 'Hàng sản xuất / Khay', 'normal', 'Khu SX', '[]'::jsonb, 'pending', 0),
        (v_plan_id, 'KHO_DONG_LANH', v_company_id, '2026-11-05', 5, 'Dọn dẹp, quét bụi kho bao bì mới ( bụi, cát rất nhiều )', 'Vệ sinh & 5S', 'important', 'Kho bao bì mới', '[]'::jsonb, 'pending', 0),
        (v_plan_id, 'KHO_DONG_LANH', v_company_id, '2026-11-05', 6, 'Ghép hàng và đưa vào kho', 'Sắp xếp & Ghép hàng', 'normal', 'Kho lạnh', '[]'::jsonb, 'pending', 0);
    END IF;
END $$;

