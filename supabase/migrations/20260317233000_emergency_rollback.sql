-- EMERGENCY ROLLBACK: Restore original data visibility
-- This script disables RLS and removes all newly added policies to restore the system 
-- to its exact previous state regarding data visibility.

DO $$
BEGIN
    -- 1. Disable RLS on tables where it was newly enabled
    ALTER TABLE IF EXISTS public.audit_logs DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.inbound_order_items DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.outbound_order_items DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.lot_items DISABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.lot_tags DISABLE ROW LEVEL SECURITY;

    -- 2. Drop all policies created in the security migrations
    DROP POLICY IF EXISTS "Strict Tenant Boundary Audit Logs" ON public.audit_logs;
    DROP POLICY IF EXISTS "Strict Tenant Boundary Inbound Items" ON public.inbound_order_items;
    DROP POLICY IF EXISTS "Strict Tenant Boundary Outbound Items" ON public.outbound_order_items;
    DROP POLICY IF EXISTS "Strict Tenant Boundary Lot Items" ON public.lot_items;
    DROP POLICY IF EXISTS "Strict Tenant Boundary Lot Tags" ON public.lot_tags;

    -- Note: We keep the company_id columns as they don't block data when RLS is disabled.
    -- This avoids data loss and allows for a safer, more gradual security update later.

END $$;
