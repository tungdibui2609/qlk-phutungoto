-- Fix User Profiles and other tables RLS: Restore PERMISSIVE policies
-- The previous migration `enforce_strict_isolation.sql` replaced permissive policies with restrictive ones.
-- We must have at least one PERMISSIVE policy to grant access.
-- The RESTRICTIVE policy "Strict Tenant Boundary" will still enforce the company isolation.

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'user_profiles',
        'systems',
        'products',
        'categories',
        'customers',
        'suppliers',
        'units',
        'inbound_orders',
        'outbound_orders',
        'qc_info',
        'vehicles',
        'operational_notes',
        'system_configs'
    ]) LOOP
        -- Create a generic permissive policy for authenticated users
        -- Note: We rely on the "Strict Tenant Boundary" RESTRICTIVE policy to filter rows.
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Permissive Policy" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Tenant Permissive Policy" ON public.%I FOR ALL USING (auth.role() = ''authenticated'')',
            t
        );
    END LOOP;
END $$;
