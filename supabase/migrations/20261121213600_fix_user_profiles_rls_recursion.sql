-- Fix infinite recursion in RLS policies on public.user_profiles
-- Policy "Allow update users" and "Allow admin delete users" previously queried
-- public.user_profiles directly inside the policy expression, causing PostgreSQL
-- error 42P17: infinite recursion detected in policy for relation "user_profiles".

-- 1. Create SECURITY DEFINER helper to read current user's account_level safely
CREATE OR REPLACE FUNCTION public.get_user_account_level()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_level integer;
BEGIN
  SELECT account_level
  INTO v_level
  FROM public.user_profiles
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN v_level;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_account_level() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_account_level() TO authenticated, service_role;

-- 2. Recreate UPDATE policy without self-referencing user_profiles
DROP POLICY IF EXISTS "Allow update users" ON public.user_profiles;

CREATE POLICY "Allow update users"
ON public.user_profiles
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  (public.get_user_account_level() = 1)
  OR (
    public.get_user_account_level() = 2
    AND company_id = public.get_user_company_id()
  )
  OR ((SELECT auth.uid()) = id)
)
WITH CHECK (
  (public.get_user_account_level() = 1)
  OR (
    public.get_user_account_level() = 2
    AND company_id = public.get_user_company_id()
  )
  OR ((SELECT auth.uid()) = id)
);

-- 3. Recreate DELETE policy without self-referencing user_profiles
DROP POLICY IF EXISTS "Allow admin delete users" ON public.user_profiles;

CREATE POLICY "Allow admin delete users"
ON public.user_profiles
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
  (public.get_user_account_level() = 1)
  OR (
    public.get_user_account_level() = 2
    AND company_id = public.get_user_company_id()
  )
);
