-- Migration: Optimize Row Level Security (RLS) and Create Missing Indexes for Multi-Tenancy Performance
-- Target: Solve database CPU bottleneck, reduce sequential scans, and utilize JWT metadata.

BEGIN;

-- 1. RE-DEFINE THE HELPER FUNCTION WITH JWT OPTIMIZATION
-- Utilizes auth.jwt() for in-memory extraction of company_id, falling back to user_profiles table query if missing.
-- Marked as STABLE so Postgres caches the result inside the same transaction/query execution context.
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID AS $$
DECLARE
  comp_id TEXT;
BEGIN
  -- A. Fetch directly from JWT user_metadata (Memory-based, extremely fast, no I/O)
  comp_id := auth.jwt() -> 'user_metadata' ->> 'company_id';
  IF comp_id IS NOT NULL THEN
    RETURN comp_id::uuid;
  END IF;

  -- B. Fallback to querying the user_profiles table (STABLE ensures this runs at most once per query)
  SELECT company_id INTO comp_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
  RETURN comp_id::uuid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. RE-APPLY OPTIMIZED RESTRICTIVE RLS POLICIES USING THE NEW HELPER FUNCTION
-- Replacing slow direct subqueries with the STABLE get_user_company_id() helper function.

-- Table: lots
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.lots;
CREATE POLICY "Strict Tenant Boundary" ON public.lots AS RESTRICTIVE FOR ALL USING (
    company_id = public.get_user_company_id()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
    OR company_id IS NULL
);

-- Table: inbound_order_items
DROP POLICY IF EXISTS "Strict Tenant Boundary Inbound Items" ON public.inbound_order_items;
CREATE POLICY "Strict Tenant Boundary Inbound Items" ON public.inbound_order_items AS RESTRICTIVE FOR ALL USING (
    company_id = public.get_user_company_id()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
);

-- Table: outbound_order_items
DROP POLICY IF EXISTS "Strict Tenant Boundary Outbound Items" ON public.outbound_order_items;
CREATE POLICY "Strict Tenant Boundary Outbound Items" ON public.outbound_order_items AS RESTRICTIVE FOR ALL USING (
    company_id = public.get_user_company_id()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
);

-- Table: lot_items
DROP POLICY IF EXISTS "Strict Tenant Boundary Lot Items" ON public.lot_items;
CREATE POLICY "Strict Tenant Boundary Lot Items" ON public.lot_items AS RESTRICTIVE FOR ALL USING (
    company_id = public.get_user_company_id()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
);

-- Table: lot_tags (Optimization: Joins to lots via lot_id using the STABLE helper function)
DROP POLICY IF EXISTS "Strict Tenant Boundary Lot Tags" ON public.lot_tags;
CREATE POLICY "Strict Tenant Boundary Lot Tags" ON public.lot_tags AS RESTRICTIVE FOR ALL USING (
    (SELECT company_id FROM public.lots WHERE id = lot_id LIMIT 1) = public.get_user_company_id()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
);

-- Table: audit_logs
DROP POLICY IF EXISTS "Strict Tenant Boundary Audit Logs" ON public.audit_logs;
CREATE POLICY "Strict Tenant Boundary Audit Logs" ON public.audit_logs AS RESTRICTIVE FOR ALL USING (
    company_id = public.get_user_company_id()
    OR auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com'
);


-- 3. CREATE CRITICAL DATABASE INDEXES FOR TENANT-BASED FILTERING
-- Eliminates Sequential Scans (Seq Scan) and utilizes Index Scans on company_id filters.

CREATE INDEX IF NOT EXISTS idx_lots_company_id ON public.lots(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_inbound_orders_company_id ON public.inbound_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_outbound_orders_company_id ON public.outbound_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON public.user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_lot_items_company_id ON public.lot_items(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_positions_company_id ON public.positions(company_id);

-- Index on lot_tags.lot_id to optimize RLS subquery checks for lot tags
CREATE INDEX IF NOT EXISTS idx_lot_tags_lot_id ON public.lot_tags(lot_id);

COMMIT;
