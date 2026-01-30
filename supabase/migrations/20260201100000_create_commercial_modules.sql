-- Create platform_modules table (Catalog of sellable features)
CREATE TABLE IF NOT EXISTS public.platform_modules (
    code text PRIMARY KEY, -- e.g. 'CONSTRUCTION', 'MANUFACTURING'
    name text NOT NULL,
    description text,
    category text DEFAULT 'ADDON', -- CORE, ADDON, UTILITY
    price_monthly numeric DEFAULT 0,
    is_public boolean DEFAULT true, -- Visible in generic marketplace list
    status text DEFAULT 'active', -- active, beta, deprecated
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Seed initial modules based on current understanding
INSERT INTO public.platform_modules (code, name, description, category, is_public)
VALUES
    ('CONSTRUCTION', 'Quản lý Công trình', 'Theo dõi dự án, tiến độ, và nhân sự thi công.', 'ADDON', true),
    ('MANUFACTURING', 'Quản lý Sản xuất', 'Quy trình sản xuất, định mức vật tư, lệnh sản xuất.', 'ADDON', true),
    ('ADVANCED_LOT', 'Quản lý Lô nâng cao', 'Tách/gộp lô, truy xuất nguồn gốc chi tiết.', 'UTILITY', true),
    ('ECOMMERCE', 'Thương mại điện tử', 'Kết nối sàn TMĐT và quản lý đơn hàng online.', 'ADDON', false)
ON CONFLICT (code) DO NOTHING;

-- Create company_subscriptions table (Who has bought what)
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    module_code text REFERENCES public.platform_modules(code) ON DELETE CASCADE,
    status text DEFAULT 'active', -- active, trial, cancelled, expired
    start_date timestamptz DEFAULT now(),
    end_date timestamptz, -- NULL means forever
    config jsonb DEFAULT '{}'::jsonb, -- Custom limits/settings for this specific sub
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(company_id, module_code) -- Prevent duplicate actve subs for same module
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_company_subs_company ON public.company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subs_module ON public.company_subscriptions(module_code);

-- Enable RLS
ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1. Platform Modules: Readable by authenticated users (to show "Available Addons")
DROP POLICY IF EXISTS "Authenticated users can read platform_modules" ON public.platform_modules;
CREATE POLICY "Authenticated users can read platform_modules" ON public.platform_modules
FOR SELECT USING (auth.role() = 'authenticated');

-- Modify only by Super Admin
DROP POLICY IF EXISTS "Super Admin can manage platform_modules" ON public.platform_modules;
CREATE POLICY "Super Admin can manage platform_modules" ON public.platform_modules
FOR ALL USING (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');

-- 2. Company Subscriptions: 
-- Read: Users can see subscriptions of their own company
DROP POLICY IF EXISTS "Users can read own company subscriptions" ON public.company_subscriptions;
CREATE POLICY "Users can read own company subscriptions" ON public.company_subscriptions
FOR SELECT USING (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()) OR 
    auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
);

-- Write: Only Super Admin (or automated system process)
DROP POLICY IF EXISTS "Super Admin can manage subscriptions" ON public.company_subscriptions;
CREATE POLICY "Super Admin can manage subscriptions" ON public.company_subscriptions
FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');

DROP POLICY IF EXISTS "Super Admin can update subscriptions" ON public.company_subscriptions;
CREATE POLICY "Super Admin can update subscriptions" ON public.company_subscriptions
FOR UPDATE USING (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');

DROP POLICY IF EXISTS "Super Admin can delete subscriptions" ON public.company_subscriptions;
CREATE POLICY "Super Admin can delete subscriptions" ON public.company_subscriptions
FOR DELETE USING (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');

-- Helper function to check subscription
CREATE OR REPLACE FUNCTION is_module_active(p_company_id uuid, p_module_code text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.company_subscriptions
        WHERE company_id = p_company_id
        AND module_code = p_module_code
        AND status IN ('active', 'trial')
        AND (end_date IS NULL OR end_date > now())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
