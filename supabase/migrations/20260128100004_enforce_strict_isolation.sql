-- ENFORCE STRICT TENANT ISOLATION
-- This script changes the isolation strategy to use RESTRICTIVE policies.
-- RESTRICTIVE policies act as a filter: they MUST be passed, regardless of other policies.

-- 1. Helper function (ensure it exists)
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 2. Apply RESTRICTIVE policies for tables with company_id
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
        
        -- Clean up previous policies
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.%I', t);

        -- Create the STRICT policy
        EXECUTE format(
            'CREATE POLICY "Strict Tenant Boundary" ON public.%I AS RESTRICTIVE FOR ALL USING (
                (company_id = get_user_company_id())
                OR
                (auth.jwt() ->> ''email'' = ''tungdibui2609@gmail.com'')
                OR
                (company_id IS NULL)
             )',
             t
        );
        
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
    END LOOP;
END $$;

-- 3. Handle COMPANIES table separately (it uses 'id', not 'company_id')
DO $$
BEGIN
    DROP POLICY IF EXISTS "Tenant Isolation Policy" ON public.companies;
    DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.companies;
    
    CREATE POLICY "Strict Tenant Boundary" ON public.companies
    AS RESTRICTIVE FOR ALL USING (
        (id = get_user_company_id())
        OR
        (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
    );
    
    ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
END $$;
