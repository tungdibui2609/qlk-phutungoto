-- Create a secure function to look up email by username
-- This is needed because 'user_profiles' RLS prevents anonymous access,
-- but the login page needs to resolve username -> email before signing in.

CREATE OR REPLACE FUNCTION public.get_user_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres/admin), bypassing RLS
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email
  FROM public.user_profiles
  WHERE username = p_username;
  
  RETURN v_email;
END;
$$;

-- Grant access to everyone (including anonymous users who are trying to log in)
GRANT EXECUTE ON FUNCTION public.get_user_email_by_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_email_by_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_email_by_username(text) TO service_role;
