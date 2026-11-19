-- ============================================================================
-- Migration: Khóa chặt cô lập dữ liệu đa khách hàng (Strict Tenant Boundary)
-- 1. Backfill company_id cho các bản ghi nghiệp vụ còn NULL dựa theo systems/FK
-- 2. Tạo trigger ensure_company_id_on_insert() + DEFAULT public.get_user_company_id()
--    để chặn triệt để việc phát sinh dòng company_id IS NULL khi insert
-- 3. Bỏ nhánh "OR (company_id IS NULL)" khỏi Strict Tenant Boundary trên toàn bộ
--    22 bảng nghiệp vụ (giữ nguyên permissions & branches dùng chung hợp lệ)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Backfill company_id cho các bản ghi còn NULL theo systems.company_id / FK
-- ----------------------------------------------------------------------------
UPDATE public.lots l
SET company_id = s.company_id
FROM public.systems s
WHERE l.company_id IS NULL
  AND l.system_code = s.code
  AND s.company_id IS NOT NULL
  AND s.code <> 'DEFAULT';

UPDATE public.inbound_orders o
SET company_id = s.company_id
FROM public.systems s
WHERE o.company_id IS NULL
  AND o.system_code = s.code
  AND s.company_id IS NOT NULL
  AND s.code <> 'DEFAULT';

UPDATE public.outbound_orders o
SET company_id = s.company_id
FROM public.systems s
WHERE o.company_id IS NULL
  AND o.system_code = s.code
  AND s.company_id IS NOT NULL
  AND s.code <> 'DEFAULT';

UPDATE public.inventory_checks c
SET company_id = s.company_id
FROM public.systems s
WHERE c.company_id IS NULL
  AND c.system_code = s.code
  AND s.company_id IS NOT NULL
  AND s.code <> 'DEFAULT';

UPDATE public.inventory_check_items i
SET company_id = c.company_id
FROM public.inventory_checks c
WHERE i.company_id IS NULL
  AND i.check_id = c.id
  AND c.company_id IS NOT NULL;

UPDATE public.positions p
SET company_id = s.company_id
FROM public.systems s
WHERE p.company_id IS NULL
  AND p.system_type = s.code
  AND s.company_id IS NOT NULL
  AND s.code <> 'DEFAULT';

UPDATE public.zones z
SET company_id = s.company_id
FROM public.systems s
WHERE z.company_id IS NULL
  AND z.system_type = s.code
  AND s.company_id IS NOT NULL
  AND s.code <> 'DEFAULT';

UPDATE public.zone_layouts zl
SET company_id = z.company_id
FROM public.zones z
WHERE zl.company_id IS NULL
  AND zl.zone_id = z.id
  AND z.company_id IS NOT NULL;

UPDATE public.qc_info q
SET company_id = s.company_id
FROM public.systems s
WHERE q.company_id IS NULL
  AND q.system_code = s.code
  AND s.company_id IS NOT NULL
  AND s.code <> 'DEFAULT';

-- ----------------------------------------------------------------------------
-- 2. Trigger function tự điền company_id khi INSERT nếu truyền NULL hoặc bỏ trống
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_company_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.get_user_company_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Đặt DEFAULT + Trigger + Khóa chặt Strict Tenant Boundary (bỏ company_id IS NULL)
--    cho toàn bộ 22 bảng nghiệp vụ
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'categories',
    'customers',
    'inbound_orders',
    'inventory_check_items',
    'inventory_checks',
    'locations',
    'lots',
    'operational_notes',
    'outbound_orders',
    'positions',
    'product_units',
    'products',
    'qc_info',
    'roles',
    'suppliers',
    'units',
    'user_profiles',
    'vehicles',
    'warehouses',
    'zone_layouts',
    'zone_templates',
    'zones'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- Đặt DEFAULT public.get_user_company_id()
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN company_id SET DEFAULT public.get_user_company_id()',
      t
    );

    -- Gắn trigger tự điền company_id trước khi INSERT (chống trường hợp code truyền NULL tường minh)
    EXECUTE format('DROP TRIGGER IF EXISTS trg_ensure_company_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_ensure_company_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ensure_company_id_on_insert()',
      t
    );

    -- Thay thế policy Strict Tenant Boundary: BỎ "OR (company_id IS NULL)"
    EXECUTE format('DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Strict Tenant Boundary" ON public.%I AS RESTRICTIVE FOR ALL TO public USING ((((SELECT auth.role()) = ''anon''::text) OR (company_id = public.get_user_company_id()) OR (((SELECT auth.jwt()) ->> ''email''::text) = ''tungdibui2609@gmail.com''::text))) WITH CHECK ((((SELECT auth.role()) = ''anon''::text) OR (company_id = public.get_user_company_id()) OR (((SELECT auth.jwt()) ->> ''email''::text) = ''tungdibui2609@gmail.com''::text)))',
      t
    );
  END LOOP;
END $$;

-- Bảng branches: đặt DEFAULT + trigger để nhánh mới tạo luôn có company_id
ALTER TABLE public.branches ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
DROP TRIGGER IF EXISTS trg_ensure_company_id ON public.branches;
CREATE TRIGGER trg_ensure_company_id
  BEFORE INSERT ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.ensure_company_id_on_insert();

COMMIT;
