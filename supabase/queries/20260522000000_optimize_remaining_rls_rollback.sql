-- SQL Rollback Script: Emergency Rollback for Remaining RLS Optimization
-- Action: Drop the new optimized policies and restore the original subquery/old function policies.
-- Safe to execute at any time on Live Production database.

BEGIN;

-- Helper function lookup old style (just in case)
CREATE OR REPLACE FUNCTION get_user_company_id_old()
RETURNS UUID AS $$
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 1. Table: branches
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.branches;
CREATE POLICY "Strict Tenant Boundary" ON public.branches AS RESTRICTIVE FOR ALL USING (
    company_id = get_user_company_id_old()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    OR company_id IS NULL
);

-- 2. Table: warehouses
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.warehouses;
CREATE POLICY "Strict Tenant Boundary" ON public.warehouses AS RESTRICTIVE FOR ALL USING (
    company_id = get_user_company_id_old()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    OR company_id IS NULL
);

-- 3. Table: zones
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.zones;
CREATE POLICY "Strict Tenant Boundary" ON public.zones AS RESTRICTIVE FOR ALL USING (
    company_id = get_user_company_id_old()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    OR company_id IS NULL
);

-- 4. Table: locations
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.locations;
CREATE POLICY "Strict Tenant Boundary" ON public.locations AS RESTRICTIVE FOR ALL USING (
    company_id = get_user_company_id_old()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    OR company_id IS NULL
);

-- 5. Table: inventory_checks
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.inventory_checks;
CREATE POLICY "Strict Tenant Boundary" ON public.inventory_checks AS RESTRICTIVE FOR ALL USING (
    company_id = get_user_company_id_old()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    OR company_id IS NULL
);

-- 6. Table: inventory_check_items
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.inventory_check_items;
CREATE POLICY "Strict Tenant Boundary" ON public.inventory_check_items AS RESTRICTIVE FOR ALL USING (
    company_id = get_user_company_id_old()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    OR company_id IS NULL
);

-- 7. Table: products
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.products;
CREATE POLICY "Strict Tenant Boundary" ON public.products AS RESTRICTIVE FOR ALL USING (
    company_id = get_user_company_id_old()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    OR company_id IS NULL
);

-- 8. Table: inbound_orders
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.inbound_orders;
CREATE POLICY "Strict Tenant Boundary" ON public.inbound_orders AS RESTRICTIVE FOR ALL USING (
    company_id = get_user_company_id_old()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    OR company_id IS NULL
);

-- 9. Table: outbound_orders
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.outbound_orders;
CREATE POLICY "Strict Tenant Boundary" ON public.outbound_orders AS RESTRICTIVE FOR ALL USING (
    company_id = get_user_company_id_old()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    OR company_id IS NULL
);

-- 10. Table: user_profiles
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.user_profiles;
CREATE POLICY "Strict Tenant Boundary" ON public.user_profiles AS RESTRICTIVE FOR ALL USING (
    company_id = get_user_company_id_old()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    OR company_id IS NULL
);

-- 11. Table: companies
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.companies;
CREATE POLICY "Strict Tenant Boundary" ON public.companies AS RESTRICTIVE FOR ALL USING (
    id = get_user_company_id_old()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
);

-- Cleanup
DROP FUNCTION IF EXISTS get_user_company_id_old();

COMMIT;
