-- ============================================================================
-- MODULE: KẾ HOẠCH SẢN XUẤT, SOẠN TỒN KHO & QUYẾT TOÁN HAO HỤT (production_plan)
-- Tuân thủ 100% chuẩn Supabase Security & Performance Advisors:
-- 1. Cô lập Multi-Tenant (company_id DEFAULT public.get_user_company_id())
-- 2. Cô lập Multi-System (system_code NOT NULL)
-- 3. RLS bật 100%, tách riêng 4 PERMISSIVE policies (SELECT, INSERT, UPDATE, DELETE) TO authenticated
-- 4. Bọc (SELECT auth.uid()) tối ưu Auth RLS Initialization Plan, không dùng user_metadata trực tiếp
-- ============================================================================

-- 0. Đăng ký module vào app_modules (is_basic = true để mở khóa license, nhưng default_enabled = false ở code để bảo toàn Kho Đông Lạnh)
INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES (
    'production_plan',
    'Kế hoạch Sản xuất & Quyết toán',
    'Quản lý kế hoạch lấy hàng tồn kho đi sản xuất/gia công lại theo khối lượng đầu vào hoặc mục tiêu thành phẩm đầu ra, soạn giữ LOT, theo dõi tiến độ từng đợt, thời gian & quyết toán hao hụt kế toán.',
    'utility',
    true
)
ON CONFLICT (id) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- 1. Bảng Kế hoạch Sản xuất gốc (production_plans)
CREATE TABLE IF NOT EXISTS public.production_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid DEFAULT public.get_user_company_id(),
    system_code text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    plan_mode text NOT NULL DEFAULT 'INPUT_DRIVEN' CHECK (plan_mode IN ('INPUT_DRIVEN', 'OUTPUT_DRIVEN', 'HYBRID')),
    status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'STAGING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELED')),
    priority text NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    production_id uuid REFERENCES public.productions(id) ON DELETE SET NULL,
    bom_id uuid REFERENCES public.boms(id) ON DELETE SET NULL,
    customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
    work_area_name text,
    requested_by_name text,
    planned_start_at timestamptz,
    planned_end_at timestamptz,
    actual_start_at timestamptz,
    actual_end_at timestamptz,
    paused_minutes integer NOT NULL DEFAULT 0,
    worker_count integer,
    allowed_loss_percent numeric NOT NULL DEFAULT 5,
    expected_yield_percent numeric,
    settled_gross_input_kg numeric NOT NULL DEFAULT 0,
    settled_returned_input_kg numeric NOT NULL DEFAULT 0,
    settled_net_input_kg numeric NOT NULL DEFAULT 0,
    settled_primary_output_kg numeric NOT NULL DEFAULT 0,
    settled_byproduct_output_kg numeric NOT NULL DEFAULT 0,
    settled_scrap_kg numeric NOT NULL DEFAULT 0,
    settled_unaccounted_loss_kg numeric NOT NULL DEFAULT 0,
    settled_total_loss_kg numeric NOT NULL DEFAULT 0,
    settled_loss_percent numeric NOT NULL DEFAULT 0,
    settled_yield_percent numeric NOT NULL DEFAULT 0,
    settlement_notes text,
    outbound_order_id uuid REFERENCES public.outbound_orders(id) ON DELETE SET NULL,
    inbound_order_id uuid REFERENCES public.inbound_orders(id) ON DELETE SET NULL,
    notes text,
    created_by uuid DEFAULT auth.uid(),
    settled_by uuid,
    settled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT production_plans_company_sys_code_key UNIQUE (company_id, system_code, code)
);

CREATE INDEX IF NOT EXISTS idx_production_plans_company_sys_status
    ON public.production_plans (company_id, system_code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_plans_production_id
    ON public.production_plans (production_id) WHERE production_id IS NOT NULL;

-- 2. Bảng Nguyên liệu Đầu vào yêu cầu (production_plan_inputs)
CREATE TABLE IF NOT EXISTS public.production_plan_inputs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid DEFAULT public.get_user_company_id(),
    system_code text NOT NULL,
    plan_id uuid NOT NULL REFERENCES public.production_plans(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    unit text NOT NULL,
    weight_per_unit_kg numeric NOT NULL DEFAULT 1,
    required_quantity numeric NOT NULL DEFAULT 0,
    is_open_quantity boolean NOT NULL DEFAULT false,
    allocated_quantity numeric NOT NULL DEFAULT 0,
    issued_quantity numeric NOT NULL DEFAULT 0,
    returned_quantity numeric NOT NULL DEFAULT 0,
    unit_cost numeric NOT NULL DEFAULT 0,
    notes text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_plan_inputs_plan_id
    ON public.production_plan_inputs (plan_id);

CREATE INDEX IF NOT EXISTS idx_production_plan_inputs_company_sys
    ON public.production_plan_inputs (company_id, system_code);

-- 3. Bảng Thành phẩm & Phụ phẩm Đầu ra mục tiêu (production_plan_outputs)
CREATE TABLE IF NOT EXISTS public.production_plan_outputs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid DEFAULT public.get_user_company_id(),
    system_code text NOT NULL,
    plan_id uuid NOT NULL REFERENCES public.production_plans(id) ON DELETE CASCADE,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    item_name text NOT NULL,
    output_type text NOT NULL DEFAULT 'PRIMARY' CHECK (output_type IN ('PRIMARY', 'BYPRODUCT', 'SCRAP')),
    unit text NOT NULL,
    weight_per_unit_kg numeric NOT NULL DEFAULT 1,
    target_quantity numeric NOT NULL DEFAULT 0,
    produced_quantity numeric NOT NULL DEFAULT 0,
    target_lot_code text,
    cost_allocation_ratio numeric NOT NULL DEFAULT 100,
    notes text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_plan_outputs_plan_id
    ON public.production_plan_outputs (plan_id);

CREATE INDEX IF NOT EXISTS idx_production_plan_outputs_company_sys
    ON public.production_plan_outputs (company_id, system_code);

-- 4. Bảng Kho Soạn Hàng / Giữ Chỗ Pallet - LOT Tồn Kho (production_plan_allocations)
CREATE TABLE IF NOT EXISTS public.production_plan_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid DEFAULT public.get_user_company_id(),
    system_code text NOT NULL,
    plan_id uuid NOT NULL REFERENCES public.production_plans(id) ON DELETE CASCADE,
    plan_input_id uuid REFERENCES public.production_plan_inputs(id) ON DELETE SET NULL,
    lot_id uuid NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
    position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    lot_code text,
    production_code text,
    position_code text,
    allocated_quantity numeric NOT NULL DEFAULT 0,
    issued_quantity numeric NOT NULL DEFAULT 0,
    returned_quantity numeric NOT NULL DEFAULT 0,
    unit text NOT NULL,
    weight_per_unit_kg numeric NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED', 'STAGED', 'PARTIAL_ISSUED', 'ISSUED', 'RETURNED', 'RELEASED')),
    export_task_id uuid REFERENCES public.export_tasks(id) ON DELETE SET NULL,
    allocated_by uuid DEFAULT auth.uid(),
    allocated_at timestamptz NOT NULL DEFAULT now(),
    notes text
);

CREATE INDEX IF NOT EXISTS idx_production_plan_allocations_plan_id
    ON public.production_plan_allocations (plan_id);

CREATE INDEX IF NOT EXISTS idx_production_plan_allocations_lot_id
    ON public.production_plan_allocations (lot_id);

CREATE INDEX IF NOT EXISTS idx_production_plan_allocations_company_sys
    ON public.production_plan_allocations (company_id, system_code, status);

-- 5. Bảng Nhật ký Thực thi Từng đợt / Ca (production_plan_logs)
CREATE TABLE IF NOT EXISTS public.production_plan_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid DEFAULT public.get_user_company_id(),
    system_code text NOT NULL,
    plan_id uuid NOT NULL REFERENCES public.production_plans(id) ON DELETE CASCADE,
    log_type text NOT NULL CHECK (log_type IN ('ISSUE_INPUT', 'RETURN_INPUT', 'PRODUCE_PRIMARY', 'PRODUCE_BYPRODUCT', 'RECORD_SCRAP')),
    plan_input_id uuid REFERENCES public.production_plan_inputs(id) ON DELETE SET NULL,
    plan_output_id uuid REFERENCES public.production_plan_outputs(id) ON DELETE SET NULL,
    allocation_id uuid REFERENCES public.production_plan_allocations(id) ON DELETE SET NULL,
    lot_id uuid REFERENCES public.lots(id) ON DELETE SET NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    item_name text NOT NULL,
    lot_code text,
    production_code text,
    position_code text,
    quantity numeric NOT NULL,
    unit text NOT NULL,
    weight_kg numeric NOT NULL DEFAULT 0,
    shift_name text,
    operator_name text,
    event_at timestamptz NOT NULL DEFAULT now(),
    notes text,
    created_by uuid DEFAULT auth.uid(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_plan_logs_plan_id_event
    ON public.production_plan_logs (plan_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_plan_logs_company_sys
    ON public.production_plan_logs (company_id, system_code);

-- Covering indexes cho toàn bộ Foreign Keys để tối ưu Supabase Performance Advisor (0 unindexed_foreign_keys)
CREATE INDEX IF NOT EXISTS idx_production_plans_bom_id
    ON public.production_plans (bom_id) WHERE bom_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_plans_customer_id
    ON public.production_plans (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_plans_outbound_order_id
    ON public.production_plans (outbound_order_id) WHERE outbound_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_plans_inbound_order_id
    ON public.production_plans (inbound_order_id) WHERE inbound_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_plan_inputs_product_id
    ON public.production_plan_inputs (product_id);
CREATE INDEX IF NOT EXISTS idx_production_plan_outputs_product_id
    ON public.production_plan_outputs (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_plan_allocations_plan_input_id
    ON public.production_plan_allocations (plan_input_id) WHERE plan_input_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_plan_allocations_position_id
    ON public.production_plan_allocations (position_id) WHERE position_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_plan_allocations_product_id
    ON public.production_plan_allocations (product_id);
CREATE INDEX IF NOT EXISTS idx_production_plan_allocations_export_task_id
    ON public.production_plan_allocations (export_task_id) WHERE export_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_plan_logs_plan_input_id
    ON public.production_plan_logs (plan_input_id) WHERE plan_input_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_plan_logs_plan_output_id
    ON public.production_plan_logs (plan_output_id) WHERE plan_output_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_plan_logs_allocation_id
    ON public.production_plan_logs (allocation_id) WHERE allocation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_plan_logs_lot_id
    ON public.production_plan_logs (lot_id) WHERE lot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_production_plan_logs_product_id
    ON public.production_plan_logs (product_id) WHERE product_id IS NOT NULL;

-- ============================================================================
-- BẬT ROW LEVEL SECURITY & TẠO PERMISSIVE POLICIES CHUẨN TỐI ƯU HIỆU NĂNG
-- ============================================================================

ALTER TABLE public.production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_plan_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_plan_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_plan_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_plan_logs ENABLE ROW LEVEL SECURITY;

-- Policies cho production_plans
DROP POLICY IF EXISTS "prod_plans_select_auth" ON public.production_plans;
CREATE POLICY "prod_plans_select_auth" ON public.production_plans
    FOR SELECT TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plans_insert_auth" ON public.production_plans;
CREATE POLICY "prod_plans_insert_auth" ON public.production_plans
    FOR INSERT TO authenticated
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plans_update_auth" ON public.production_plans;
CREATE POLICY "prod_plans_update_auth" ON public.production_plans
    FOR UPDATE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())))
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plans_delete_auth" ON public.production_plans;
CREATE POLICY "prod_plans_delete_auth" ON public.production_plans
    FOR DELETE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

-- Policies cho production_plan_inputs
DROP POLICY IF EXISTS "prod_plan_inputs_select_auth" ON public.production_plan_inputs;
CREATE POLICY "prod_plan_inputs_select_auth" ON public.production_plan_inputs
    FOR SELECT TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plan_inputs_insert_auth" ON public.production_plan_inputs;
CREATE POLICY "prod_plan_inputs_insert_auth" ON public.production_plan_inputs
    FOR INSERT TO authenticated
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plan_inputs_update_auth" ON public.production_plan_inputs;
CREATE POLICY "prod_plan_inputs_update_auth" ON public.production_plan_inputs
    FOR UPDATE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())))
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plan_inputs_delete_auth" ON public.production_plan_inputs;
CREATE POLICY "prod_plan_inputs_delete_auth" ON public.production_plan_inputs
    FOR DELETE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

-- Policies cho production_plan_outputs
DROP POLICY IF EXISTS "prod_plan_outputs_select_auth" ON public.production_plan_outputs;
CREATE POLICY "prod_plan_outputs_select_auth" ON public.production_plan_outputs
    FOR SELECT TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plan_outputs_insert_auth" ON public.production_plan_outputs;
CREATE POLICY "prod_plan_outputs_insert_auth" ON public.production_plan_outputs
    FOR INSERT TO authenticated
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plan_outputs_update_auth" ON public.production_plan_outputs;
CREATE POLICY "prod_plan_outputs_update_auth" ON public.production_plan_outputs
    FOR UPDATE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())))
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plan_outputs_delete_auth" ON public.production_plan_outputs;
CREATE POLICY "prod_plan_outputs_delete_auth" ON public.production_plan_outputs
    FOR DELETE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

-- Policies cho production_plan_allocations
DROP POLICY IF EXISTS "prod_plan_allocs_select_auth" ON public.production_plan_allocations;
CREATE POLICY "prod_plan_allocs_select_auth" ON public.production_plan_allocations
    FOR SELECT TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plan_allocs_insert_auth" ON public.production_plan_allocations;
CREATE POLICY "prod_plan_allocs_insert_auth" ON public.production_plan_allocations
    FOR INSERT TO authenticated
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plan_allocs_update_auth" ON public.production_plan_allocations;
CREATE POLICY "prod_plan_allocs_update_auth" ON public.production_plan_allocations
    FOR UPDATE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())))
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plan_allocs_delete_auth" ON public.production_plan_allocations;
CREATE POLICY "prod_plan_allocs_delete_auth" ON public.production_plan_allocations
    FOR DELETE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

-- Policies cho production_plan_logs
DROP POLICY IF EXISTS "prod_plan_logs_select_auth" ON public.production_plan_logs;
CREATE POLICY "prod_plan_logs_select_auth" ON public.production_plan_logs
    FOR SELECT TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plan_logs_insert_auth" ON public.production_plan_logs;
CREATE POLICY "prod_plan_logs_insert_auth" ON public.production_plan_logs
    FOR INSERT TO authenticated
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plan_logs_update_auth" ON public.production_plan_logs;
CREATE POLICY "prod_plan_logs_update_auth" ON public.production_plan_logs
    FOR UPDATE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())))
    WITH CHECK ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

DROP POLICY IF EXISTS "prod_plan_logs_delete_auth" ON public.production_plan_logs;
CREATE POLICY "prod_plan_logs_delete_auth" ON public.production_plan_logs
    FOR DELETE TO authenticated
    USING ((company_id IS NULL) OR (company_id = (SELECT public.get_user_company_id())));

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
