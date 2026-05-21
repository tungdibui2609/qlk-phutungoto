-- Rollback Migration: Revert Row Level Security (RLS) Optimizations and Delete New Indexes
-- Target: Restore original policies, drop new indexes, and revert helper function.

BEGIN;

-- 1. REVERT CRITICAL INDEXES
DROP INDEX IF EXISTS public.idx_lots_company_id;
DROP INDEX IF EXISTS public.idx_products_company_id;
DROP INDEX IF EXISTS public.idx_inbound_orders_company_id;
DROP INDEX IF EXISTS public.idx_outbound_orders_company_id;
DROP INDEX IF EXISTS public.idx_user_profiles_company_id;
DROP INDEX IF EXISTS public.idx_customers_company_id;
DROP INDEX IF EXISTS public.idx_suppliers_company_id;
DROP INDEX IF EXISTS public.idx_lot_items_company_id;
DROP INDEX IF EXISTS public.idx_audit_logs_company_id;
DROP INDEX IF EXISTS public.idx_positions_company_id;
DROP INDEX IF EXISTS public.idx_lot_tags_lot_id;


-- 2. REVERT RLS POLICIES TO ORIGINAL DIRECT SUBQUERIES

-- Table: lots
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.lots;
CREATE POLICY "Strict Tenant Boundary" ON public.lots AS RESTRICTIVE FOR ALL USING (
    (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1))
    OR (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
    OR (company_id IS NULL)
);

-- Table: inbound_order_items
DROP POLICY IF EXISTS "Strict Tenant Boundary Inbound Items" ON public.inbound_order_items;
CREATE POLICY "Strict Tenant Boundary Inbound Items" ON public.inbound_order_items AS RESTRICTIVE FOR ALL USING (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
    OR (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com' )
);

-- Table: outbound_order_items
DROP POLICY IF EXISTS "Strict Tenant Boundary Outbound Items" ON public.outbound_order_items;
CREATE POLICY "Strict Tenant Boundary Outbound Items" ON public.outbound_order_items AS RESTRICTIVE FOR ALL USING (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
    OR (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com' )
);

-- Table: lot_items
DROP POLICY IF EXISTS "Strict Tenant Boundary Lot Items" ON public.lot_items;
CREATE POLICY "Strict Tenant Boundary Lot Items" ON public.lot_items AS RESTRICTIVE FOR ALL USING (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
    OR (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com' )
);

-- Table: lot_tags
DROP POLICY IF EXISTS "Strict Tenant Boundary Lot Tags" ON public.lot_tags;
CREATE POLICY "Strict Tenant Boundary Lot Tags" ON public.lot_tags AS RESTRICTIVE FOR ALL USING (
    (SELECT company_id FROM public.lots WHERE id = lot_id LIMIT 1) = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
    OR (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
);

-- Table: audit_logs
DROP POLICY IF EXISTS "Strict Tenant Boundary Audit Logs" ON public.audit_logs;
CREATE POLICY "Strict Tenant Boundary Audit Logs" ON public.audit_logs AS RESTRICTIVE FOR ALL USING (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
    OR (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com' )
);


-- 3. REVERT THE HELPER FUNCTION TO ITS ORIGINAL STATE
-- Original: Only queries user_profiles table directly without checking JWT metadata.
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID AS $$
    SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMIT;
