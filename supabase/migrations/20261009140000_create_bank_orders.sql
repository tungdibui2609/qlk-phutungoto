-- Create bank_inbound_orders and bank_outbound_orders for bank document printing only (no inventory impact)

CREATE TABLE IF NOT EXISTS public.bank_inbound_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    status text DEFAULT 'Completed',
    warehouse_name text,
    supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name text,
    supplier_address text,
    supplier_phone text,
    description text,
    system_code text DEFAULT 'FROZEN',
    system_type text DEFAULT 'FROZEN',
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name text,
    metadata jsonb DEFAULT '{}'::jsonb,
    images jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.bank_inbound_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES public.bank_inbound_orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    product_name text NOT NULL,
    unit text,
    quantity numeric NOT NULL DEFAULT 1,
    price numeric(15,2) DEFAULT 0,
    note text,
    document_quantity numeric DEFAULT 0,
    document_unit text,
    conversion_rate numeric DEFAULT 1,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.bank_outbound_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    status text DEFAULT 'Completed',
    warehouse_name text,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name text,
    customer_address text,
    customer_phone text,
    description text,
    system_code text DEFAULT 'FROZEN',
    system_type text DEFAULT 'FROZEN',
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name text,
    metadata jsonb DEFAULT '{}'::jsonb,
    images jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.bank_outbound_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES public.bank_outbound_orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    product_name text NOT NULL,
    unit text,
    quantity numeric NOT NULL DEFAULT 1,
    price numeric(15,2) DEFAULT 0,
    note text,
    document_quantity numeric DEFAULT 0,
    document_unit text,
    conversion_rate numeric DEFAULT 1,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bank_inbound_orders_system_code ON public.bank_inbound_orders(system_code);
CREATE INDEX IF NOT EXISTS idx_bank_inbound_orders_created_at ON public.bank_inbound_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_bank_inbound_order_items_order_id ON public.bank_inbound_order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_bank_outbound_orders_system_code ON public.bank_outbound_orders(system_code);
CREATE INDEX IF NOT EXISTS idx_bank_outbound_orders_created_at ON public.bank_outbound_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_bank_outbound_order_items_order_id ON public.bank_outbound_order_items(order_id);

ALTER TABLE public.bank_inbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_inbound_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_outbound_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_outbound_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users on bank_inbound_orders" ON public.bank_inbound_orders;
DROP POLICY IF EXISTS "Enable all for authenticated users on bank_inbound_order_items" ON public.bank_inbound_order_items;
DROP POLICY IF EXISTS "Enable all for authenticated users on bank_outbound_orders" ON public.bank_outbound_orders;
DROP POLICY IF EXISTS "Enable all for authenticated users on bank_outbound_order_items" ON public.bank_outbound_order_items;
DROP POLICY IF EXISTS "Enable read for anon on bank_inbound_orders" ON public.bank_inbound_orders;
DROP POLICY IF EXISTS "Enable read for anon on bank_inbound_order_items" ON public.bank_inbound_order_items;
DROP POLICY IF EXISTS "Enable read for anon on bank_outbound_orders" ON public.bank_outbound_orders;
DROP POLICY IF EXISTS "Enable read for anon on bank_outbound_order_items" ON public.bank_outbound_order_items;

CREATE POLICY "Enable all for authenticated users on bank_inbound_orders" ON public.bank_inbound_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users on bank_inbound_order_items" ON public.bank_inbound_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users on bank_outbound_orders" ON public.bank_outbound_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users on bank_outbound_order_items" ON public.bank_outbound_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable read for anon on bank_inbound_orders" ON public.bank_inbound_orders FOR SELECT TO anon USING (true);
CREATE POLICY "Enable read for anon on bank_inbound_order_items" ON public.bank_inbound_order_items FOR SELECT TO anon USING (true);
CREATE POLICY "Enable read for anon on bank_outbound_orders" ON public.bank_outbound_orders FOR SELECT TO anon USING (true);
CREATE POLICY "Enable read for anon on bank_outbound_order_items" ON public.bank_outbound_order_items FOR SELECT TO anon USING (true);
