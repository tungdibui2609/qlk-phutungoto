-- EMERGENCY PATCH: Restore Data Visibility
-- This migration relaxes the RESTRICTIVE policies to allow records with NULL company_id
-- specifically for existing data that hasn't been backfilled yet.

DO $$
BEGIN
    -- 1. Relax Audit Logs Policy
    DROP POLICY IF EXISTS "Strict Tenant Boundary Audit Logs" ON public.audit_logs;
    CREATE POLICY "Strict Tenant Boundary Audit Logs" ON public.audit_logs AS RESTRICTIVE 
    USING (
        company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
        OR company_id IS NULL
        OR (auth.jwt() ->> 'email') = 'tungdibui2609@gmail.com'
    );

    -- 2. Relax Inbound Order Items Policy
    DROP POLICY IF EXISTS "Strict Tenant Boundary Inbound Items" ON public.inbound_order_items;
    CREATE POLICY "Strict Tenant Boundary Inbound Items" ON public.inbound_order_items AS RESTRICTIVE 
    USING (
        company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
        OR company_id IS NULL
        OR (auth.jwt() ->> 'email') = 'tungdibui2609@gmail.com'
    );

    -- 3. Relax Outbound Order Items Policy
    DROP POLICY IF EXISTS "Strict Tenant Boundary Outbound Items" ON public.outbound_order_items;
    CREATE POLICY "Strict Tenant Boundary Outbound Items" ON public.outbound_order_items AS RESTRICTIVE 
    USING (
        company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
        OR company_id IS NULL
        OR (auth.jwt() ->> 'email') = 'tungdibui2609@gmail.com'
    );

    -- 4. Relax Lot Items Policy
    DROP POLICY IF EXISTS "Strict Tenant Boundary Lot Items" ON public.lot_items;
    CREATE POLICY "Strict Tenant Boundary Lot Items" ON public.lot_items AS RESTRICTIVE 
    USING (
        company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
        OR company_id IS NULL
        OR (auth.jwt() ->> 'email') = 'tungdibui2609@gmail.com'
    );

    -- 5. Relax Lot Tags Policy
    DROP POLICY IF EXISTS "Strict Tenant Boundary Lot Tags" ON public.lot_tags;
    CREATE POLICY "Strict Tenant Boundary Lot Tags" ON public.lot_tags AS RESTRICTIVE 
    USING (
        (SELECT company_id FROM public.lots WHERE id = lot_id LIMIT 1) = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid() LIMIT 1)
        OR (SELECT company_id FROM public.lots WHERE id = lot_id LIMIT 1) IS NULL
        OR (auth.jwt() ->> 'email') = 'tungdibui2609@gmail.com'
    );

    -- 6. Re-attempt more aggressive backfill to fix the root cause
    -- Re-backfill lot_items
    UPDATE public.lot_items li
    SET company_id = l.company_id
    FROM public.lots l
    WHERE li.lot_id = l.id
    AND li.company_id IS NULL;

    -- Re-backfill inbound_order_items
    UPDATE public.inbound_order_items ioi
    SET company_id = io.company_id
    FROM public.inbound_orders io
    WHERE ioi.order_id = io.id
    AND ioi.company_id IS NULL;

    -- Re-backfill outbound_order_items
    UPDATE public.outbound_order_items ooi
    SET company_id = oo.company_id
    FROM public.outbound_orders oo
    WHERE ooi.order_id = oo.id
    AND ooi.company_id IS NULL;

END $$;
