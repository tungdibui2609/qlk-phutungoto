-- DEBUG & FIX AUTH SCHEMA ERRORS
-- This script matches the instance_id of the restored admin to the system default,
-- grants necessary permissions, and forces a schema cache reload.

DO $$
DECLARE
    valid_instance_id uuid;
BEGIN
    -- 1. Find a valid instance_id (from any existing user, or default to the global '0000...' if none)
    SELECT instance_id INTO valid_instance_id FROM auth.users LIMIT 1;
    
    IF valid_instance_id IS NULL THEN
        valid_instance_id := '00000000-0000-0000-0000-000000000000';
    END IF;

    -- 2. Update the Super Admin to use the correct instance_id
    UPDATE auth.users 
    SET instance_id = valid_instance_id -- Ensure this matches the system
    WHERE email = 'tungdibui2609@gmail.com';

    -- 3. Grant Permissions to Internal Roles (Fix for "Database error querying schema")
    GRANT USAGE ON SCHEMA auth TO postgres, authenticated, anon, service_role;
    GRANT SELECT ON TABLE auth.users TO postgres, service_role; -- App usually doesn't select directly, but triggers might
    
    -- Grant public schema access again just in case
    GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

    -- 4. Notify PostgREST to reload the schema cache (Crucial after RLS/Permission changes)
    NOTIFY pgrst, 'reload schema';
    
END $$;
