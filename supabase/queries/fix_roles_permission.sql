-- =============================================================================
-- FIX ROLES TABLE PERMISSION
-- =============================================================================

-- Problem: Authenticated users (Level 2) cannot see roles in the dropdown.
-- Solution: Ensure RLS is enabled and a permissive SELECT policy exists.

-- 1. Enable RLS (standard practice)
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- 2. Clean up old policies to avoid conflicts
DO $$ 
BEGIN 
    BEGIN EXECUTE 'DROP POLICY "authenticated_access_roles" ON public.roles'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "allow_read_roles" ON public.roles'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE 'DROP POLICY "roles_read_policy" ON public.roles'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- 3. Create a clear, simple SELECT policy for ALL authenticated users
CREATE POLICY "allow_read_roles" ON public.roles
FOR SELECT TO authenticated
USING (true);

-- 4. Explicitly Grant Select Permission
GRANT SELECT ON public.roles TO authenticated;
