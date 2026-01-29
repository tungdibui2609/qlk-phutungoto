-- FIX PERMISSIONS & EXTENSIONS
-- "Database error querying schema" often means permissions were lost or extensions are glitchy.

BEGIN;

-- 1. Grant usage on public schema
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Ensure standard extensions are on
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 3. Verify user exists (Just to be sure the restore worked)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'tungdibui2609@gmail.com') THEN
        RAISE EXCEPTION 'User tungdibui2609@gmail.com NOT FOUND. Please run restore_super_admin.sql first.';
    END IF;
END $$;

COMMIT;
