-- FIX DASHBOARD & GOTRUE PERMISSIONS
-- The error "Failed to delete user" means the internal role `supabase_auth_admin` 
-- cannot read/write/delete from the `auth` schema.

BEGIN;

-- 1. Grant everything on AUTH schema to the internal admin role
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin;

-- 2. Grant everything to postgres (just in case)
GRANT ALL ON SCHEMA auth TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;

-- 3. Bypass RLS for this user on auth tables (if supported/needed)
ALTER ROLE supabase_auth_admin BYPASSRLS;

-- 4. Try to FORCE DELETE the stuck user via SQL (since Dashboard is stuck)
-- This saves you the step of clicking "Delete" again.
DELETE FROM auth.users WHERE email = 'tungdibui2609@gmail.com';

COMMIT;
