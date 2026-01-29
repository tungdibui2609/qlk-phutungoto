-- DEEP FIX FOR AUTH SCHEMA PERMISSIONS
-- The error "Database error checking email" or "querying schema" indicates
-- that the database user used by Supabase Auth (GoTrue) lost access to the `auth` schema.

BEGIN;

-- 1. Grant generic USAGE on schema
GRANT USAGE ON SCHEMA auth TO postgres, anon, authenticated, service_role;

-- 2. Grant Table Access (SELECT, INSERT, UPDATE, DELETE)
GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO anon, authenticated;

-- 3. Grant Sequence Access (for SERIAL/IDENTITY columns)
GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO postgres, service_role;

-- 4. Grant Routine/Function Access
GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO postgres, service_role;

-- 5. SPECIFIC FIX: Grant access to `supabase_auth_admin` if it exists (Used by GoTrue in some setups)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
        GRANT ALL ON ALL TABLES IN SCHEMA auth TO supabase_auth_admin;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
        GRANT ALL ON ALL ROUTINES IN SCHEMA auth TO supabase_auth_admin;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_user') THEN
        GRANT ALL ON ALL TABLES IN SCHEMA auth TO dashboard_user;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA auth TO dashboard_user;
    END IF;
END $$;

-- 6. Reload Schema Cache
NOTIFY pgrst, 'reload schema';

COMMIT;
