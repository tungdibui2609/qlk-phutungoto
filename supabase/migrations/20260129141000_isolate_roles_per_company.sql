-- ISOLATE ROLES PER COMPANY
-- 1. Add company_id to roles
-- 2. Update existing records
-- 3. Update constraints
-- 4. Enable strict RLS

BEGIN;

-- 1. Add company_id column
ALTER TABLE public.roles 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 1.5 DROP the old unique constraint FIRST to allow duplicates during migration
-- Role code should be unique PER COMPANY, but during migration it will be duplicated
ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS roles_code_key;
DROP INDEX IF EXISTS roles_code_key;

-- 2. Populate and Isolate existing roles
-- First, ensure all roles have a company_id (assign NULLs to default company)
DO $$
DECLARE
    default_company_id UUID;
BEGIN
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;
    UPDATE public.roles SET company_id = default_company_id WHERE company_id IS NULL;
END $$;

-- Second, create local copies for each company that is using a role not belonging to it
DO $$
DECLARE
    r RECORD;
    new_role_id UUID;
    default_company_id UUID;
BEGIN
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;

    FOR r IN (
        SELECT DISTINCT up.company_id, rl.code, rl.name, rl.description, rl.permissions, rl.is_system
        FROM public.user_profiles up
        JOIN public.roles rl ON up.role_id = rl.id
        WHERE up.company_id != rl.company_id
    ) LOOP
        -- Check if a role with this code already exists for this company
        SELECT id INTO new_role_id FROM public.roles WHERE code = r.code AND company_id = r.company_id LIMIT 1;
        
        IF new_role_id IS NULL THEN
            INSERT INTO public.roles (code, name, description, permissions, is_system, company_id)
            VALUES (r.code, r.name, r.description, r.permissions, r.is_system, r.company_id)
            RETURNING id INTO new_role_id;
        END IF;
        
        -- Link all users of this company to the new (or existing) company-specific role
        UPDATE public.user_profiles 
        SET role_id = new_role_id 
        FROM public.roles old_r
        WHERE user_profiles.role_id = old_r.id 
          AND user_profiles.company_id = r.company_id
          AND old_r.code = r.code
          AND old_r.company_id != r.company_id;
    END LOOP;
END $$;

-- 2.5 CRITICAL: Clean up any duplicates before applying unique constraint
-- This handles if multiple global roles had the same code or if previous migration failed
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT code, company_id, MIN(id::text)::uuid as primary_id
        FROM public.roles
        GROUP BY code, company_id
        HAVING COUNT(*) > 1
    ) LOOP
        -- Move users to the primary role
        UPDATE public.user_profiles 
        SET role_id = r.primary_id 
        WHERE role_id IN (SELECT id FROM public.roles WHERE code = r.code AND company_id = r.company_id AND id != r.primary_id);
        
        -- Delete redundant roles
        DELETE FROM public.roles WHERE code = r.code AND company_id = r.company_id AND id != r.primary_id;
    END LOOP;
END $$;

-- 3. Update Unique Constraint
-- Create new unique constraint
ALTER TABLE public.roles ADD CONSTRAINT roles_code_company_id_key UNIQUE (code, company_id);

-- 4. Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Drop permissive policies
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.roles;

-- Helper function to get company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Strict Tenant Boundary (RESTRICTIVE)
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.roles;
CREATE POLICY "Strict Tenant Boundary" ON public.roles
AS RESTRICTIVE FOR ALL USING (
    (company_id = get_user_company_id())
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
);

-- Permissive behavior for the company users
-- 1. Everyone in the company can READ their company roles
DROP POLICY IF EXISTS "Allow users to read company roles" ON public.roles;
CREATE POLICY "Allow users to read company roles" ON public.roles
FOR SELECT
USING (true); -- Filtered by the RESTRICTIVE policy above

-- 2. Only admins can MANAGE roles
-- To avoid recursion, we check the role_id directly from user_profiles if we know the admin role names
DROP POLICY IF EXISTS "Enable all for company admins" ON public.roles;
CREATE POLICY "Enable all for company admins" ON public.roles
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        JOIN public.roles r ON up.role_id = r.id
        WHERE up.id = auth.uid()
        AND r.code = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles up
        JOIN public.roles r ON up.role_id = r.id
        WHERE up.id = auth.uid()
        AND r.code = 'admin'
    )
);

-- 5. AUTOMATION: Copy default roles for new companies
CREATE OR REPLACE FUNCTION copy_default_roles_to_new_company()
RETURNS TRIGGER AS $$
DECLARE
    default_company_id UUID;
BEGIN
    -- Get default company ID (identifier for the 'template' company)
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;
    
    -- If we are creating the default company itself, skip
    IF NEW.id = default_company_id THEN
        RETURN NEW;
    END IF;

    -- Copy all roles from default company to the new company
    INSERT INTO public.roles (code, name, description, permissions, is_system, company_id)
    SELECT code, name, description, permissions, is_system, NEW.id
    FROM public.roles
    WHERE company_id = default_company_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_copy_roles_on_company_creation ON public.companies;
CREATE TRIGGER trigger_copy_roles_on_company_creation
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION copy_default_roles_to_new_company();

COMMIT;
