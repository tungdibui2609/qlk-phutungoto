-- Update RLS policies for Multi-Tenancy (Tenant Isolation)

-- 1. Helper function for RLS checks (to avoid recursion errors)
-- This function checks if the row's company_id matches the user's company_id
-- We use a function to keep policies clean.
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Update policies for all relevant tables
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
        -- Drop existing policies that might conflict
        -- (Strictly speaking, we should rename/merge them, but for transition 
        -- we want to enforce the company_id check everywhere)
        
        -- Create a blanket policy for tenant isolation
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Tenant Isolation Policy" ON public.%I FOR ALL USING (company_id = get_user_company_id())',
            t
        );
        
        -- Enable RLS just in case it wasn't
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- 3. Specific Bypass for Superuser (tungdibui2609@gmail.com)
-- Authorized superuser can see everything
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
        'system_configs',
        'companies'
    ]) LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Superuser Bypass Policy" ON public.%I', t);
        EXECUTE format(
            'CREATE POLICY "Superuser Bypass Policy" ON public.%I FOR ALL USING (auth.jwt() ->> ''email'' = ''tungdibui2609@gmail.com'')',
            t
        );
    END LOOP;
END $$;
