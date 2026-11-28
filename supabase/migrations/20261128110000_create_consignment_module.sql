-- ============================================================================
-- MODULE: QUẢN LÝ HÀNG HÓA KÝ GỬI (consignment_manager)
-- Tuân thủ 100% chuẩn Supabase Security & Performance Advisors:
-- 1. Cô lập Multi-Tenant (company_id DEFAULT public.get_user_company_id())
-- 2. Cô lập Multi-System (system_code NOT NULL)
-- 3. RLS bật 100%, tách riêng 4 PERMISSIVE policies (SELECT, INSERT, UPDATE, DELETE) TO authenticated
-- 4. Bọc (SELECT public.get_user_company_id()) tối ưu Auth RLS Initialization Plan
-- ============================================================================

-- 0. Đăng ký module vào app_modules (is_basic = true để mở khóa license, default_enabled = false ở code để bảo toàn Kho Đông Lạnh)
INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES (
    'consignment_manager',
    'Quản lý Hàng hóa Ký gửi',
    'Quản lý hàng hóa của kho mang đi gửi tại các kho bên ngoài: nhập, xuất, tồn kho ký gửi và liên kết chuyển phiếu 2 chiều với Kế toán gốc.',
    'utility',
    true
)
ON CONFLICT (id) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- 1. Danh mục Kho ký gửi bên ngoài (consignment_warehouses)
CREATE TABLE IF NOT EXISTS public.consignment_warehouses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid DEFAULT public.get_user_company_id(),
    system_code text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    address text,
    contact_name text,
    contact_phone text,
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT consignment_warehouses_company_sys_code_key UNIQUE (company_id, system_code, code)
);

CREATE INDEX IF NOT EXISTS idx_consignment_warehouses_company_sys
    ON public.consignment_warehouses (company_id, system_code, is_active);

-- 2. Phiếu Nhập / Xuất Kho ký gửi (consignment_orders)
CREATE TABLE IF NOT EXISTS public.consignment_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid DEFAULT public.get_user_company_id(),
    system_code text NOT NULL,
    code text NOT NULL,
    direction text NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    outbound_purpose text CHECK (
        outbound_purpose IS NULL
        OR outbound_purpose IN ('RETURN_TO_MAIN', 'DIRECT_DELIVERY', 'ADJUSTMENT')
    ),
    consignment_warehouse_id uuid NOT NULL REFERENCES public.consignment_warehouses(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'Completed' CHECK (status IN ('Pending', 'Completed', 'Cancelled')),
    order_date timestamptz NOT NULL DEFAULT now(),
    description text,
    partner_name text,
    vehicle_number text,
    driver_name text,
    -- Liên kết chiều đi: Từ Phiếu xuất Kế toán gốc -> tạo Phiếu nhập Ký gửi
    source_outbound_order_id uuid REFERENCES public.outbound_orders(id) ON DELETE SET NULL,
    source_outbound_order_code text,
    -- Liên kết chiều về: Từ Phiếu xuất Ký gửi -> tạo Phiếu nhập Kế toán gốc
    linked_inbound_order_id uuid REFERENCES public.inbound_orders(id) ON DELETE SET NULL,
    linked_inbound_order_code text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT consignment_orders_company_sys_code_key UNIQUE (company_id, system_code, code)
);

CREATE INDEX IF NOT EXISTS idx_consignment_orders_company_sys_dir_date
    ON public.consignment_orders (company_id, system_code, direction, order_date DESC);

CREATE INDEX IF NOT EXISTS idx_consignment_orders_warehouse
    ON public.consignment_orders (consignment_warehouse_id, status);

-- Chống chuyển trùng 1 phiếu xuất kế toán thành nhiều phiếu nhập ký gửi đang hiệu lực
CREATE UNIQUE INDEX IF NOT EXISTS uq_consignment_orders_source_outbound_active
    ON public.consignment_orders (source_outbound_order_id)
    WHERE direction = 'INBOUND' AND source_outbound_order_id IS NOT NULL AND status <> 'Cancelled';

CREATE INDEX IF NOT EXISTS idx_consignment_orders_linked_inbound
    ON public.consignment_orders (linked_inbound_order_id)
    WHERE linked_inbound_order_id IS NOT NULL;

-- 3. Chi tiết hàng hóa trong phiếu ký gửi (consignment_order_items)
CREATE TABLE IF NOT EXISTS public.consignment_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid DEFAULT public.get_user_company_id(),
    system_code text NOT NULL,
    order_id uuid NOT NULL REFERENCES public.consignment_orders(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    product_name text NOT NULL,
    sku text,
    unit text NOT NULL,
    quantity numeric NOT NULL DEFAULT 0,
    batch_code text,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consignment_order_items_order_id
    ON public.consignment_order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_consignment_order_items_company_sys_prod
    ON public.consignment_order_items (company_id, system_code, product_id);

-- 4. Bật RLS & tạo 4 PERMISSIVE policies tách riêng cho từng bảng
ALTER TABLE public.consignment_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consignment_order_items ENABLE ROW LEVEL SECURITY;

-- Policies cho consignment_warehouses
DROP POLICY IF EXISTS "consignment_wh_select_auth" ON public.consignment_warehouses;
CREATE POLICY "consignment_wh_select_auth" ON public.consignment_warehouses
    FOR SELECT TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "consignment_wh_insert_auth" ON public.consignment_warehouses;
CREATE POLICY "consignment_wh_insert_auth" ON public.consignment_warehouses
    FOR INSERT TO authenticated
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "consignment_wh_update_auth" ON public.consignment_warehouses;
CREATE POLICY "consignment_wh_update_auth" ON public.consignment_warehouses
    FOR UPDATE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())))
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "consignment_wh_delete_auth" ON public.consignment_warehouses;
CREATE POLICY "consignment_wh_delete_auth" ON public.consignment_warehouses
    FOR DELETE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

-- Policies cho consignment_orders
DROP POLICY IF EXISTS "consignment_orders_select_auth" ON public.consignment_orders;
CREATE POLICY "consignment_orders_select_auth" ON public.consignment_orders
    FOR SELECT TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "consignment_orders_insert_auth" ON public.consignment_orders;
CREATE POLICY "consignment_orders_insert_auth" ON public.consignment_orders
    FOR INSERT TO authenticated
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "consignment_orders_update_auth" ON public.consignment_orders;
CREATE POLICY "consignment_orders_update_auth" ON public.consignment_orders
    FOR UPDATE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())))
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "consignment_orders_delete_auth" ON public.consignment_orders;
CREATE POLICY "consignment_orders_delete_auth" ON public.consignment_orders
    FOR DELETE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

-- Policies cho consignment_order_items
DROP POLICY IF EXISTS "consignment_items_select_auth" ON public.consignment_order_items;
CREATE POLICY "consignment_items_select_auth" ON public.consignment_order_items
    FOR SELECT TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "consignment_items_insert_auth" ON public.consignment_order_items;
CREATE POLICY "consignment_items_insert_auth" ON public.consignment_order_items
    FOR INSERT TO authenticated
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "consignment_items_update_auth" ON public.consignment_order_items;
CREATE POLICY "consignment_items_update_auth" ON public.consignment_order_items
    FOR UPDATE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())))
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "consignment_items_delete_auth" ON public.consignment_order_items;
CREATE POLICY "consignment_items_delete_auth" ON public.consignment_order_items
    FOR DELETE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
