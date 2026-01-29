-- COMPREHENSIVE MULTI-TENANT ISOLATION FIX
-- This script fixes missing menus, missing company info, and missing modules.

BEGIN;

-- 1. Ensure the helper function is robust
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Repair User Profiles (Ensure everyone has a company_id)
-- If we can derive it from the username (prefix.user), do it.
UPDATE public.user_profiles
SET company_id = (SELECT id FROM public.companies WHERE code = split_part(username, '.', 1) LIMIT 1)
WHERE company_id IS NULL AND username LIKE '%.%';

-- Assign anyone else still NULL to the default company
DO $$
DECLARE
    default_company_id UUID;
BEGIN
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;
    UPDATE public.user_profiles SET company_id = default_company_id WHERE company_id IS NULL;
END $$;

-- 3. Fix Roles RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.roles;
CREATE POLICY "Strict Tenant Boundary" ON public.roles
AS RESTRICTIVE FOR ALL USING (
    (company_id = get_user_company_id())
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
    OR
    (company_id IS NULL) -- Allow templates
);

-- 4. Fix Company Settings RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read company settings" ON public.company_settings;
CREATE POLICY "Public read company settings" ON public.company_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.company_settings;
CREATE POLICY "Strict Tenant Boundary" ON public.company_settings
AS RESTRICTIVE FOR ALL USING (
    (id = get_user_company_id())
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
);

-- 5. AUTOMATION: Copy Systems and Configs for new/existing companies
-- We need to ensure every company has its own systems or can see global ones.
-- For now, let's make systems and system_configs more permissive for reading if global.
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.systems;
CREATE POLICY "Strict Tenant Boundary" ON public.systems
AS RESTRICTIVE FOR ALL USING (
    (company_id = get_user_company_id())
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
    OR
    (company_id IS NULL)
);

DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.system_configs;
CREATE POLICY "Strict Tenant Boundary" ON public.system_configs
AS RESTRICTIVE FOR ALL USING (
    (company_id = get_user_company_id())
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
    OR
    (company_id IS NULL)
);

-- 6. Trigger to copy default systems for new companies (like we did for roles)
CREATE OR REPLACE FUNCTION copy_defaults_to_new_company()
RETURNS TRIGGER AS $$
DECLARE
    default_company_id UUID;
BEGIN
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;
    IF NEW.id = default_company_id THEN RETURN NEW; END IF;

    -- 1. Copy Roles (if not already handled by the other trigger)
    -- We'll assume the other trigger exists or we can combine them.
    
    -- 2. Copy Systems
    INSERT INTO public.systems (code, name, description, modules, bg_color_class, text_color_class, icon, is_active, sort_order, company_id)
    SELECT code, name, description, modules, bg_color_class, text_color_class, icon, is_active, sort_order, NEW.id
    FROM public.systems
    WHERE company_id = default_company_id
    ON CONFLICT DO NOTHING;

    -- 3. Copy System Configs
    INSERT INTO public.system_configs (system_code, inbound_modules, outbound_modules, lot_modules, dashboard_modules, company_id)
    SELECT system_code, inbound_modules, outbound_modules, lot_modules, dashboard_modules, NEW.id
    FROM public.system_configs
    WHERE company_id = default_company_id
    ON CONFLICT DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_copy_defaults_on_company_creation ON public.companies;
CREATE TRIGGER trigger_copy_defaults_on_company_creation
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION copy_defaults_to_new_company();

-- 7. BACKFILL: Duplicating systems for existing companies that are missing them
DO $$
DECLARE
    comp RECORD;
    default_company_id UUID;
BEGIN
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;
    
    FOR comp IN (SELECT id FROM public.companies WHERE id != default_company_id) LOOP
        -- Copy systems if missing
        INSERT INTO public.systems (code, name, description, modules, bg_color_class, text_color_class, icon, is_active, sort_order, company_id)
        SELECT code, name, description, modules, bg_color_class, text_color_class, icon, is_active, sort_order, comp.id
        FROM public.systems
        WHERE company_id = default_company_id
        AND code NOT IN (SELECT code FROM public.systems WHERE company_id = comp.id);

        -- Copy configs if missing
        INSERT INTO public.system_configs (system_code, inbound_modules, outbound_modules, lot_modules, dashboard_modules, company_id)
        SELECT system_code, inbound_modules, outbound_modules, lot_modules, dashboard_modules, comp.id
        FROM public.system_configs
        WHERE company_id = default_company_id
        AND system_code NOT IN (SELECT system_code FROM public.system_configs WHERE company_id = comp.id);

        -- REPAIR: Update existing systems that were partially created with NULL styles/modules
        UPDATE public.systems s
        SET 
            bg_color_class = t.bg_color_class,
            text_color_class = t.text_color_class,
            icon = t.icon,
            modules = t.modules,
            sort_order = t.sort_order
        FROM public.systems t
        WHERE t.company_id = default_company_id 
        AND s.company_id = comp.id 
        AND s.code = t.code
        AND (s.bg_color_class IS NULL OR s.modules IS NULL);
    END LOOP;
END $$;

COMMIT;
