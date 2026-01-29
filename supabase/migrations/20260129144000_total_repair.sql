-- TOTAL MULTI-TENANT ISOLATION REPAIR SCRIPT
-- This script fixes role links, RLS visibility, and missing company info.

BEGIN;

-- 1. Robust Helper Function
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Repair User Profiles (LINK TO COMPANY)
-- Ensure every profile has a company_id derived from their username or default.
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

-- 3. REPAIR PROFILE -> ROLE LINK
-- Many users might be pointing to "Template" roles (anywarehouse_id) which are hidden by RESTRICTIVE RLS.
-- We must point them to their local company roles.
DO $$
DECLARE
    user_rec RECORD;
    local_role_id UUID;
    template_role_code TEXT;
BEGIN
    FOR user_rec IN (
        SELECT up.id, up.company_id, r.code 
        FROM public.user_profiles up
        JOIN public.roles r ON up.role_id = r.id
        WHERE r.company_id = (SELECT id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1)
        AND up.company_id != (SELECT id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1)
    ) LOOP
        -- Find the same role code within the user's company
        SELECT id INTO local_role_id FROM public.roles 
        WHERE code = user_rec.code AND company_id = user_rec.company_id 
        LIMIT 1;
        
        IF local_role_id IS NOT NULL THEN
            UPDATE public.user_profiles SET role_id = local_role_id WHERE id = user_rec.id;
        END IF;
    END LOOP;
END $$;

-- 4. FIX RLS POLICIES (Make them readable for relevant users)

-- Company Settings: Must be readable by users of that company
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.company_settings;
CREATE POLICY "Strict Tenant Boundary" ON public.company_settings
AS RESTRICTIVE FOR ALL USING (
    (id = get_user_company_id())
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
);

-- Roles: Reliable read for your company + templates
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.roles;
CREATE POLICY "Strict Tenant Boundary" ON public.roles
AS RESTRICTIVE FOR ALL USING (
    (company_id = get_user_company_id())
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
    OR
    (company_id = (SELECT id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1))
);

-- 5. Backfill missing company settings rows (if any)
INSERT INTO public.company_settings (id, name)
SELECT id, code
FROM public.companies
ON CONFLICT (id) DO NOTHING;

-- 6. Ensure Systems and Configs are ready
-- (Already handled by previous script, but let's re-run the loop for safety)
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
