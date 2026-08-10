drop extension if exists "pg_net";

drop policy "Allow all access to company_settings for authenticated users" on "public"."company_settings";

drop policy "Enable insert/update for authenticated users" on "public"."company_settings";

drop policy "Enable public read access" on "public"."company_settings";

drop policy "Enable read access for all users" on "public"."company_settings";

drop policy "Public read company settings" on "public"."company_settings";

drop policy "Strict Tenant Boundary" on "public"."company_settings";

drop policy "Allow users to read company roles" on "public"."roles";

drop policy "Enable all for company admins" on "public"."roles";

drop policy "Enable read/write for users based on company_id" on "public"."systems";

drop policy "Strict Tenant Boundary" on "public"."systems";

drop policy "Superuser Bypass Policy" on "public"."systems";

drop policy "Tenant Permissive Policy" on "public"."systems";

drop policy "company_admin_insert" on "public"."user_profiles";

drop policy "company_admin_read_company" on "public"."user_profiles";

drop policy "company_admin_update_company" on "public"."user_profiles";

drop policy "super_admin_all" on "public"."user_profiles";

drop policy "users_read_own" on "public"."user_profiles";

drop policy "users_update_own" on "public"."user_profiles";

drop policy "Enable read access for all users" on "public"."systems";

alter table "public"."product_units" drop constraint "product_units_product_id_unit_id_key";

alter table "public"."products" drop constraint "products_internal_lvl1_id_fkey";

alter table "public"."products" drop constraint "products_internal_lvl2_id_fkey";

alter table "public"."products" drop constraint "products_internal_lvl3_id_fkey";

alter table "public"."products" drop constraint "products_internal_lvl4_id_fkey";

alter table "public"."audit_logs" drop constraint "audit_logs_changed_by_fkey";

alter table "public"."categories" drop constraint "categories_company_id_fkey";

alter table "public"."inventory_checks" drop constraint "inventory_checks_reviewer_id_fkey";

alter table "public"."master_tags" drop constraint "master_tags_company_id_fkey";

alter table "public"."products" drop constraint "products_company_id_fkey";

alter table "public"."units" drop constraint "units_company_id_fkey";

drop view if exists "public"."production_allocation_statistics";

drop view if exists "public"."production_item_statistics";

alter table "public"."master_tags" drop constraint "master_tags_pkey";

drop index if exists "public"."master_tags_pkey";

drop index if exists "public"."product_units_product_id_unit_id_key";


  create table "public"."export_tasks" (
    "id" uuid not null default gen_random_uuid(),
    "code" text not null,
    "status" text not null default 'Pending'::text,
    "notes" text,
    "system_code" text,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "created_by" uuid,
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."export_tasks" enable row level security;


  create table "public"."inventory_check_item_logs" (
    "id" uuid not null default gen_random_uuid(),
    "item_id" uuid not null,
    "user_id" uuid,
    "user_name" text,
    "content" text not null,
    "actual_quantity" numeric,
    "system_quantity" numeric,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "company_id" uuid,
    "is_reviewer" boolean default false,
    "unit" text,
    "snapshot_data" jsonb
      );


alter table "public"."inventory_check_item_logs" enable row level security;


  create table "public"."pending_assignments" (
    "id" uuid not null default gen_random_uuid(),
    "position_id" uuid,
    "lot_stt" integer not null,
    "production_date" date not null,
    "system_code" text not null,
    "created_by" uuid,
    "created_at" timestamp with time zone default now(),
    "status" text default 'pending'::text
      );


alter table "public"."pending_assignments" enable row level security;


  create table "public"."production_inputs" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "production_id" uuid,
    "product_id" uuid,
    "lot_id" uuid,
    "lot_item_id" uuid,
    "quantity" numeric not null,
    "unit" text,
    "weight_kg" numeric not null,
    "system_code" text not null,
    "created_at" timestamp with time zone default now()
      );



  create table "public"."warehouse_layouts" (
    "id" uuid not null default gen_random_uuid(),
    "system_type" text not null,
    "company_id" uuid,
    "name" text not null,
    "width" integer not null default 20,
    "height" integer not null default 20,
    "grid_data" jsonb not null default '[]'::jsonb,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now())
      );


alter table "public"."warehouse_layouts" enable row level security;


  create table "public"."warehouse_snapshots" (
    "id" uuid not null default gen_random_uuid(),
    "system_code" text not null,
    "snapshot_date" date not null,
    "position_id" uuid not null,
    "lot_id" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."warehouse_snapshots" enable row level security;

alter table "public"."companies" add column "custom_domain" text;

alter table "public"."export_task_items" add column "position_id" uuid;

alter table "public"."export_task_items" add column "priority" integer;

alter table "public"."export_task_items" add column "status" text default 'Pending'::text;

alter table "public"."export_task_items" alter column "created_at" set default timezone('utc'::text, now());

alter table "public"."export_task_items" alter column "created_at" set not null;

alter table "public"."export_task_items" alter column "quantity" drop default;

alter table "public"."export_task_items" alter column "quantity" set not null;

alter table "public"."export_task_items" alter column "task_id" set not null;

alter table "public"."export_task_items" enable row level security;

alter table "public"."fresh_material_batches" add column "document_urls" jsonb default '[]'::jsonb;

alter table "public"."fresh_material_receivings" add column "document_urls" jsonb default '[]'::jsonb;

alter table "public"."fresh_material_stages" add column "document_urls" jsonb default '[]'::jsonb;

-- alter table "public"."inbound_order_items" alter column "quantity" set data type numeric using "quantity"::numeric;

-- alter table "public"."inbound_order_items" alter column "total_amount" set default (quantity * price);

alter table "public"."lot_items" alter column "quantity" set data type numeric using "quantity"::numeric;

alter table "public"."lots" add column "images" jsonb default '[]'::jsonb;

alter table "public"."lots" add column "packaging_date" date;

alter table "public"."lots" add column "qc_id" text;

alter table "public"."lots" add column "warehouse_name" text;

alter table "public"."lots" alter column "quantity" set data type numeric using "quantity"::numeric;

alter table "public"."master_tags" alter column "company_id" drop default;

alter table "public"."master_tags" alter column "company_id" drop not null;

-- alter table "public"."outbound_order_items" alter column "quantity" set data type numeric using "quantity"::numeric;

-- alter table "public"."outbound_order_items" alter column "total_amount" set default (quantity * price);

alter table "public"."permissions" disable row level security;

alter table "public"."production_lots" alter column "is_locked" set not null;

alter table "public"."production_lots" alter column "production_date" drop default;

alter table "public"."productions" add column "production_type" text default 'NEW'::text;

alter table "public"."products" add column "color" character varying(50);

alter table "public"."user_profiles" disable row level security;

alter table "public"."zone_layouts" add column "alternating_rows" boolean default false;

alter table "public"."zone_layouts" add column "header_color" character varying(20) default NULL::character varying;

alter table "public"."zone_layouts" add column "header_text_color" character varying(20) default NULL::character varying;

alter table "public"."zone_status_layouts" drop column "company_id";

alter table "public"."zone_status_layouts" drop column "layout_data";

alter table "public"."zone_status_layouts" drop column "system_code";

alter table "public"."zone_status_layouts" add column "cell_height" integer default 0;

alter table "public"."zone_status_layouts" add column "cell_width" integer default 0;

alter table "public"."zone_status_layouts" add column "child_columns" integer default 0;

alter table "public"."zone_status_layouts" add column "child_layout" text default 'vertical'::text;

alter table "public"."zone_status_layouts" add column "child_width" integer default 0;

alter table "public"."zone_status_layouts" add column "collapsible" boolean default true;

alter table "public"."zone_status_layouts" add column "container_height" integer default 0;

alter table "public"."zone_status_layouts" add column "display_type" text default 'auto'::text;

alter table "public"."zone_status_layouts" add column "layout_gap" integer default 16;

alter table "public"."zone_status_layouts" add column "position_columns" integer default 10;

alter table "public"."zone_status_layouts" alter column "zone_id" set not null;

alter table "public"."zone_status_layouts" enable row level security;

CREATE UNIQUE INDEX companies_custom_domain_key ON public.companies USING btree (custom_domain);

CREATE UNIQUE INDEX export_tasks_code_key ON public.export_tasks USING btree (code);

CREATE UNIQUE INDEX export_tasks_pkey ON public.export_tasks USING btree (id);

CREATE INDEX idx_companies_custom_domain ON public.companies USING btree (custom_domain);

CREATE INDEX idx_inv_check_item_logs_item_id ON public.inventory_check_item_logs USING btree (item_id);

CREATE INDEX idx_production_inputs_production_id ON public.production_inputs USING btree (production_id);

CREATE UNIQUE INDEX inventory_check_item_logs_pkey ON public.inventory_check_item_logs USING btree (id);

CREATE UNIQUE INDEX pending_assignments_pkey ON public.pending_assignments USING btree (id);

CREATE UNIQUE INDEX production_inputs_pkey ON public.production_inputs USING btree (id);

CREATE UNIQUE INDEX unique_lot_in_positions ON public.positions USING btree (lot_id) WHERE (lot_id IS NOT NULL);

CREATE UNIQUE INDEX warehouse_layouts_pkey ON public.warehouse_layouts USING btree (id);

CREATE UNIQUE INDEX warehouse_snapshots_pkey ON public.warehouse_snapshots USING btree (id);

CREATE INDEX warehouse_snapshots_system_date_idx ON public.warehouse_snapshots USING btree (system_code, snapshot_date);

CREATE UNIQUE INDEX zone_status_layouts_zone_id_key ON public.zone_status_layouts USING btree (zone_id);

alter table "public"."export_tasks" add constraint "export_tasks_pkey" PRIMARY KEY using index "export_tasks_pkey";

alter table "public"."inventory_check_item_logs" add constraint "inventory_check_item_logs_pkey" PRIMARY KEY using index "inventory_check_item_logs_pkey";

alter table "public"."pending_assignments" add constraint "pending_assignments_pkey" PRIMARY KEY using index "pending_assignments_pkey";

alter table "public"."production_inputs" add constraint "production_inputs_pkey" PRIMARY KEY using index "production_inputs_pkey";

alter table "public"."warehouse_layouts" add constraint "warehouse_layouts_pkey" PRIMARY KEY using index "warehouse_layouts_pkey";

alter table "public"."warehouse_snapshots" add constraint "warehouse_snapshots_pkey" PRIMARY KEY using index "warehouse_snapshots_pkey";

alter table "public"."companies" add constraint "companies_custom_domain_key" UNIQUE using index "companies_custom_domain_key";

alter table "public"."export_task_items" add constraint "export_task_items_position_id_fkey" FOREIGN KEY (position_id) REFERENCES public.positions(id) not valid;

alter table "public"."export_task_items" validate constraint "export_task_items_position_id_fkey";

alter table "public"."export_task_items" add constraint "export_task_items_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) not valid;

alter table "public"."export_task_items" validate constraint "export_task_items_product_id_fkey";

alter table "public"."export_task_items" add constraint "export_task_items_task_id_fkey" FOREIGN KEY (task_id) REFERENCES public.export_tasks(id) ON DELETE CASCADE not valid;

alter table "public"."export_task_items" validate constraint "export_task_items_task_id_fkey";

alter table "public"."export_tasks" add constraint "export_tasks_code_key" UNIQUE using index "export_tasks_code_key";

alter table "public"."export_tasks" add constraint "export_tasks_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."export_tasks" validate constraint "export_tasks_created_by_fkey";

alter table "public"."fresh_material_batches" add constraint "fk_fresh_batches_company" FOREIGN KEY (company_id) REFERENCES public.companies(id) not valid;

alter table "public"."fresh_material_batches" validate constraint "fk_fresh_batches_company";

alter table "public"."inventory_check_item_logs" add constraint "inventory_check_item_logs_item_id_fkey" FOREIGN KEY (item_id) REFERENCES public.inventory_check_items(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_check_item_logs" validate constraint "inventory_check_item_logs_item_id_fkey";

alter table "public"."inventory_check_item_logs" add constraint "inventory_check_item_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) not valid;

alter table "public"."inventory_check_item_logs" validate constraint "inventory_check_item_logs_user_id_fkey";

alter table "public"."lots" add constraint "lots_qc_id_fkey" FOREIGN KEY (qc_id) REFERENCES public.qc_info(id) ON DELETE SET NULL not valid;

alter table "public"."lots" validate constraint "lots_qc_id_fkey";

alter table "public"."pending_assignments" add constraint "pending_assignments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."pending_assignments" validate constraint "pending_assignments_created_by_fkey";

alter table "public"."pending_assignments" add constraint "pending_assignments_position_id_fkey" FOREIGN KEY (position_id) REFERENCES public.positions(id) not valid;

alter table "public"."pending_assignments" validate constraint "pending_assignments_position_id_fkey";

alter table "public"."positions" add constraint "fk_positions_lot_id" FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE SET NULL not valid;

alter table "public"."positions" validate constraint "fk_positions_lot_id";

alter table "public"."production_inputs" add constraint "production_inputs_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES public.lots(id) not valid;

alter table "public"."production_inputs" validate constraint "production_inputs_lot_id_fkey";

alter table "public"."production_inputs" add constraint "production_inputs_product_id_fkey" FOREIGN KEY (product_id) REFERENCES public.products(id) not valid;

alter table "public"."production_inputs" validate constraint "production_inputs_product_id_fkey";

alter table "public"."production_inputs" add constraint "production_inputs_production_id_fkey" FOREIGN KEY (production_id) REFERENCES public.productions(id) ON DELETE CASCADE not valid;

alter table "public"."production_inputs" validate constraint "production_inputs_production_id_fkey";

alter table "public"."warehouse_snapshots" add constraint "warehouse_snapshots_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE SET NULL not valid;

alter table "public"."warehouse_snapshots" validate constraint "warehouse_snapshots_lot_id_fkey";

alter table "public"."warehouse_snapshots" add constraint "warehouse_snapshots_position_id_fkey" FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE CASCADE not valid;

alter table "public"."warehouse_snapshots" validate constraint "warehouse_snapshots_position_id_fkey";

alter table "public"."zone_status_layouts" add constraint "zone_status_layouts_zone_id_fkey" FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE CASCADE not valid;

alter table "public"."zone_status_layouts" validate constraint "zone_status_layouts_zone_id_fkey";

alter table "public"."zone_status_layouts" add constraint "zone_status_layouts_zone_id_key" UNIQUE using index "zone_status_layouts_zone_id_key";

alter table "public"."audit_logs" add constraint "audit_logs_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES auth.users(id) not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_changed_by_fkey";

alter table "public"."categories" add constraint "categories_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.company_settings(id) ON DELETE CASCADE not valid;

alter table "public"."categories" validate constraint "categories_company_id_fkey";

alter table "public"."inventory_checks" add constraint "inventory_checks_reviewer_id_fkey" FOREIGN KEY (reviewer_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_checks" validate constraint "inventory_checks_reviewer_id_fkey";

alter table "public"."master_tags" add constraint "master_tags_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.company_settings(id) ON DELETE CASCADE not valid;

alter table "public"."master_tags" validate constraint "master_tags_company_id_fkey";

alter table "public"."products" add constraint "products_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.company_settings(id) ON DELETE CASCADE not valid;

alter table "public"."products" validate constraint "products_company_id_fkey";

alter table "public"."units" add constraint "units_company_id_fkey" FOREIGN KEY (company_id) REFERENCES public.company_settings(id) ON DELETE CASCADE not valid;

alter table "public"."units" validate constraint "units_company_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT company_id FROM user_profiles WHERE id = auth.uid() LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_branch_rename()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Chỉ chạy khi tên chi nhánh thực sự bị thay đổi
    IF NEW.name <> OLD.name THEN
        
        -- Cập nhật bảng lots
        UPDATE public.lots 
        SET warehouse_name = NEW.name 
        WHERE warehouse_name = OLD.name;
        
        -- Cập nhật bảng inbound_orders
        UPDATE public.inbound_orders 
        SET warehouse_name = NEW.name 
        WHERE warehouse_name = OLD.name;
        
        -- Cập nhật bảng outbound_orders
        UPDATE public.outbound_orders 
        SET warehouse_name = NEW.name 
        WHERE warehouse_name = OLD.name;
        
        -- Cập nhật bảng inventory_checks
        UPDATE public.inventory_checks 
        SET warehouse_name = NEW.name 
        WHERE warehouse_name = OLD.name;

        -- Cập nhật bảng locations
        UPDATE public.locations 
        SET name = NEW.name 
        WHERE name = OLD.name;
        
    END IF;
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_lot_item_initial_quantity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.initial_quantity IS NULL OR NEW.initial_quantity = 0 THEN
        NEW.initial_quantity := NEW.quantity;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_inventory_check(p_check_id uuid, p_reviewer_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 1. Kiểm tra phiếu có tồn tại và đang chờ duyệt không
  IF NOT EXISTS (
    SELECT 1 FROM inventory_checks 
    WHERE id = p_check_id AND status = 'WAITING_FOR_APPROVAL'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Phiếu không tồn tại hoặc không ở trạng thái chờ duyệt');
  END IF;

  -- 2. Cập nhật trạng thái phiếu (Việc cân bằng kho sẽ làm qua PNK/PXK sau)
  UPDATE inventory_checks
  SET 
    status = 'COMPLETED',
    approval_status = 'APPROVED',
    reviewer_id = p_reviewer_id,
    reviewed_at = NOW(),
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_check_id;

  RETURN jsonb_build_object('success', true, 'message', 'Duyệt phiếu thành công. Hãy tạo phiếu Nhập/Xuất để cân bằng sổ sách.');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_position_lot_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_is_locked BOOLEAN;
BEGIN
    IF NEW.lot_id IS NOT NULL THEN
        SELECT is_locked INTO v_is_locked
        FROM public.lots
        WHERE id = NEW.lot_id;
        
        IF v_is_locked = true THEN
            RAISE EXCEPTION 'Không thể gán vị trí cho lô hàng đang bị khóa.';
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.copy_defaults_to_new_company()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    default_company_id UUID;
BEGIN
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;
    IF NEW.id = default_company_id THEN RETURN NEW; END IF;

    -- NOTE: system_configs logic is removed because the table was dropped.
    -- Settings and data seeding are now handled by the API in 96bd86d.
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.extract_weight_from_unit(unit_name text)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    weight_match text[];
BEGIN
    -- Look for pattern like "(10 Kg)" or "(Thùng 10 kg)" or "(... 10.5 kg)"
    -- Matches: (10 kg), (10.5 Kg), (Thùng 10kg), (Thùng 10.5 KG)
    weight_match := regexp_matches(unit_name, '\(\s*.*?\s*(\d+(\.\d+)?)\s*[kK]?[gG]\s*\)');
    IF weight_match IS NOT NULL AND array_length(weight_match, 1) >= 1 THEN
        RETURN weight_match[1]::numeric;
    END IF;
    RETURN 1.0; -- Default if no pattern found (e.g. "Kg", "Cái")
EXCEPTION WHEN OTHERS THEN
    RETURN 1.0;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_set_initial_quantity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.initial_quantity IS NULL OR NEW.initial_quantity = 0 THEN
        NEW.initial_quantity := NEW.quantity;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_lot_ids_in_zone(p_system_code text, p_zone_ids text[])
 RETURNS TABLE(lot_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    WITH RECURSIVE zone_tree AS (
        -- Base: the provided zone IDs
        SELECT id FROM zones 
        WHERE id = ANY(p_zone_ids::uuid[]) 
          AND system_type = p_system_code
        UNION ALL
        -- Recursive: all descendant zones
        SELECT z.id FROM zones z 
        JOIN zone_tree zt ON z.parent_id = zt.id
        WHERE z.system_type = p_system_code
    )
    SELECT DISTINCT p.lot_id
    FROM positions p
    JOIN zone_positions zp ON zp.position_id = p.id
    WHERE zp.zone_id IN (SELECT id FROM zone_tree)
      AND p.lot_id IS NOT NULL
      AND p.system_type = p_system_code;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_lot_lock_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.is_locked = true AND (OLD.is_locked IS NULL OR OLD.is_locked = false) THEN
        UPDATE public.positions
        SET lot_id = NULL
        WHERE lot_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.issue_production_loan_fifo(p_product_id uuid, p_worker_name text, p_total_quantity numeric, p_unit text, p_system_code text, p_production_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_remaining_qty NUMERIC := p_total_quantity;
    v_lot_item RECORD;
    v_deduct_qty NUMERIC;
    v_new_lot_item_qty NUMERIC;
    v_lot_total_qty NUMERIC;
BEGIN
    -- 1. Check total availability first to avoid partial failures
    SELECT SUM(li.quantity) INTO v_lot_total_qty
    FROM public.lot_items li
    JOIN public.lots l ON li.lot_id = l.id
    WHERE li.product_id = p_product_id 
      AND l.system_code = p_system_code
      AND li.quantity > 0;

    IF v_lot_total_qty IS NULL OR v_lot_total_qty < p_total_quantity THEN
        RAISE EXCEPTION 'Không đủ tồn kho để cấp phát. Yêu cầu: %, Hiện có: %', p_total_quantity, COALESCE(v_lot_total_qty, 0);
    END IF;

    -- 2. Iterate through lot_items in FIFO order
    FOR v_lot_item IN 
        SELECT li.id as lot_item_id, li.quantity as item_qty, l.id as lot_id, l.code as lot_code
        FROM public.lot_items li
        JOIN public.lots l ON li.lot_id = l.id
        WHERE li.product_id = p_product_id 
          AND l.system_code = p_system_code
          AND li.quantity > 0
        ORDER BY l.created_at ASC, l.id ASC
    LOOP
        IF v_remaining_qty <= 0 THEN
            EXIT;
        END IF;

        v_deduct_qty := LEAST(v_lot_item.item_qty, v_remaining_qty);
        v_new_lot_item_qty := v_lot_item.item_qty - v_deduct_qty;

        -- A. Update lot_item quantity
        UPDATE public.lot_items 
        SET quantity = v_new_lot_item_qty
        WHERE id = v_lot_item.lot_item_id;

        -- B. Create production_loan record
        INSERT INTO public.production_loans (
            lot_item_id,
            product_id,
            worker_name,
            quantity,
            unit,
            status,
            system_code,
            production_id,
            notes
        ) VALUES (
            v_lot_item.lot_item_id,
            p_product_id,
            p_worker_name,
            v_deduct_qty,
            p_unit,
            'active',
            p_system_code,
            p_production_id,
            p_notes
        );

        -- C. Update LOT total quantity and status
        -- We recalculate total lot quantity to be safe
        SELECT SUM(quantity) INTO v_lot_total_qty
        FROM public.lot_items
        WHERE lot_id = v_lot_item.lot_id;

        UPDATE public.lots
        SET 
            quantity = COALESCE(v_lot_total_qty, 0),
            status = CASE 
                WHEN COALESCE(v_lot_total_qty, 0) <= 0.000001 THEN 'Đã xuất hết cho công trình'
                ELSE status -- Keep current status if still has items, or 'active' if it was empty (though it shouldn't be if we are here)
            END
        WHERE id = v_lot_item.lot_id;

        v_remaining_qty := v_remaining_qty - v_deduct_qty;
    END LOOP;

    -- Final safety check
    IF v_remaining_qty > 0.000001 THEN
        RAISE EXCEPTION 'Lỗi logic FIFO: Còn dư % chưa được trừ', v_remaining_qty;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.issue_production_loan_fifo(p_product_id uuid, p_worker_name text, p_total_quantity numeric, p_unit text, p_system_code text, p_production_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_tag text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_remaining_qty NUMERIC := p_total_quantity;
    v_lot_item RECORD;
    v_deduct_qty NUMERIC;
    v_new_lot_item_qty NUMERIC;
    v_lot_total_qty NUMERIC;
BEGIN
    -- 1. Check total availability
    SELECT SUM(li.quantity) INTO v_lot_total_qty
    FROM public.lot_items li
    JOIN public.lots l ON li.lot_id = l.id
    LEFT JOIN public.lot_tags lt ON lt.lot_item_id = li.id
    WHERE li.product_id = p_product_id 
      AND l.system_code = p_system_code
      AND li.quantity > 0
      AND (
        (p_tag IS NULL AND lt.tag IS NULL) OR 
        (p_tag IS NOT NULL AND lt.tag = p_tag)
      );

    IF v_lot_total_qty IS NULL OR v_lot_total_qty < p_total_quantity THEN
        RAISE EXCEPTION 'Không đủ tồn kho % (%) để cấp phát. Yêu cầu: %, Hiện có: %', 
            COALESCE(p_tag, 'không tag'), p_unit, p_total_quantity, COALESCE(v_lot_total_qty, 0);
    END IF;

    -- 2. Iterate through matching lot_items in FIFO order
    FOR v_lot_item IN 
        SELECT li.id as lot_item_id, li.quantity as item_qty, l.id as lot_id
        FROM public.lot_items li
        JOIN public.lots l ON li.lot_id = l.id
        LEFT JOIN public.lot_tags lt ON lt.lot_item_id = li.id
        WHERE li.product_id = p_product_id 
          AND l.system_code = p_system_code
          AND li.quantity > 0
          AND (
            (p_tag IS NULL AND lt.tag IS NULL) OR 
            (p_tag IS NOT NULL AND lt.tag = p_tag)
          )
        ORDER BY l.created_at ASC, l.id ASC
    LOOP
        IF v_remaining_qty <= 0 THEN
            EXIT;
        END IF;

        v_deduct_qty := LEAST(v_lot_item.item_qty, v_remaining_qty);
        v_new_lot_item_qty := v_lot_item.item_qty - v_deduct_qty;

        -- A. Update lot_item quantity
        UPDATE public.lot_items 
        SET quantity = v_new_lot_item_qty
        WHERE id = v_lot_item.lot_item_id;

        -- B. Create production_loan record (Now including TAG)
        INSERT INTO public.production_loans (
            lot_item_id,
            product_id,
            worker_name,
            quantity,
            unit,
            status,
            system_code,
            production_id,
            notes,
            tag -- ADDED
        ) VALUES (
            v_lot_item.lot_item_id,
            p_product_id,
            p_worker_name,
            v_deduct_qty,
            p_unit,
            'active',
            p_system_code,
            p_production_id,
            p_notes,
            p_tag -- ADDED
        );

        -- C. Update LOT total quantity and status
        SELECT SUM(quantity) INTO v_lot_total_qty
        FROM public.lot_items
        WHERE lot_id = v_lot_item.lot_id;

        UPDATE public.lots
        SET 
            quantity = COALESCE(v_lot_total_qty, 0),
            status = CASE 
                WHEN COALESCE(v_lot_total_qty, 0) <= 0.000001 THEN 'Đã xuất hết cho công trình'
                ELSE status 
            END
        WHERE id = v_lot_item.lot_id;

        v_remaining_qty := v_remaining_qty - v_deduct_qty;
    END LOOP;

    IF v_remaining_qty > 0.000001 THEN
        RAISE EXCEPTION 'Lỗi logic FIFO: Còn dư % chưa được trừ', v_remaining_qty;
    END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.issue_production_loan_fifo(p_product_id uuid, p_worker_name text, p_total_quantity numeric, p_unit text, p_system_code text, p_production_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text, p_tag text DEFAULT NULL::text, p_batch_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_remaining_qty NUMERIC := p_total_quantity;
    v_lot_item RECORD;
    v_deduct_qty NUMERIC;
    v_new_lot_item_qty NUMERIC;
    v_lot_total_qty NUMERIC;
BEGIN
    -- 1. Check total availability
    SELECT SUM(li.quantity) INTO v_lot_total_qty
    FROM public.lot_items li
    JOIN public.lots l ON li.lot_id = l.id
    LEFT JOIN public.lot_tags lt ON lt.lot_item_id = li.id
    WHERE li.product_id = p_product_id 
      AND l.system_code = p_system_code
      AND li.quantity > 0
      AND (
        (p_tag IS NULL AND lt.tag IS NULL) OR 
        (p_tag IS NOT NULL AND lt.tag = p_tag)
      );

    IF v_lot_total_qty IS NULL OR v_lot_total_qty < p_total_quantity THEN
        RAISE EXCEPTION 'Không đủ tồn kho % (%) để cấp phát. Yêu cầu: %, Hiện có: %', 
            COALESCE(p_tag, 'không tag'), p_unit, p_total_quantity, COALESCE(v_lot_total_qty, 0);
    END IF;

    -- 2. Iterate through matching lot_items in FIFO order
    FOR v_lot_item IN 
        SELECT li.id as lot_item_id, li.quantity as item_qty, l.id as lot_id
        FROM public.lot_items li
        JOIN public.lots l ON li.lot_id = l.id
        LEFT JOIN public.lot_tags lt ON lt.lot_item_id = li.id
        WHERE li.product_id = p_product_id 
          AND l.system_code = p_system_code
          AND li.quantity > 0
          AND (
            (p_tag IS NULL AND lt.tag IS NULL) OR 
            (p_tag IS NOT NULL AND lt.tag = p_tag)
          )
        ORDER BY l.created_at ASC, l.id ASC
    LOOP
        IF v_remaining_qty <= 0 THEN
            EXIT;
        END IF;

        v_deduct_qty := LEAST(v_lot_item.item_qty, v_remaining_qty);
        v_new_lot_item_qty := v_lot_item.item_qty - v_deduct_qty;

        -- A. Update lot_item quantity
        UPDATE public.lot_items 
        SET quantity = v_new_lot_item_qty
        WHERE id = v_lot_item.lot_item_id;

        -- B. Create production_loan record (with batch_id)
        INSERT INTO public.production_loans (
            lot_item_id,
            product_id,
            worker_name,
            quantity,
            unit,
            status,
            system_code,
            production_id,
            notes,
            tag,
            batch_id
        ) VALUES (
            v_lot_item.lot_item_id,
            p_product_id,
            p_worker_name,
            v_deduct_qty,
            p_unit,
            'active',
            p_system_code,
            p_production_id,
            p_notes,
            p_tag,
            p_batch_id
        );

        -- C. Update LOT total quantity and status
        SELECT SUM(quantity) INTO v_lot_total_qty
        FROM public.lot_items
        WHERE lot_id = v_lot_item.lot_id;

        UPDATE public.lots
        SET 
            quantity = COALESCE(v_lot_total_qty, 0),
            status = CASE 
                WHEN COALESCE(v_lot_total_qty, 0) <= 0.000001 THEN 'Đã xuất hết cho công trình'
                ELSE status 
            END
        WHERE id = v_lot_item.lot_id;

        v_remaining_qty := v_remaining_qty - v_deduct_qty;
    END LOOP;

    IF v_remaining_qty > 0.000001 THEN
        RAISE EXCEPTION 'Lỗi logic FIFO: Còn dư % chưa được trừ', v_remaining_qty;
    END IF;
END;
$function$
;

create or replace view "public"."production_allocation_statistics" as  SELECT p.id AS production_id,
    p.code AS production_code,
    p.name AS production_name,
    pl.product_id,
    prod.name AS product_name,
    prod.sku AS product_sku,
    sum(
        CASE
            WHEN (pl.status = 'active'::text) THEN pl.quantity
            ELSE (0)::numeric
        END) AS total_issued,
    sum(
        CASE
            WHEN (pl.status = 'returned'::text) THEN pl.quantity
            ELSE (0)::numeric
        END) AS total_returned,
    sum(
        CASE
            WHEN (pl.status = 'lost'::text) THEN pl.quantity
            ELSE (0)::numeric
        END) AS total_lost,
    pl.unit
   FROM ((public.productions p
     JOIN public.production_loans pl ON ((pl.production_id = p.id)))
     JOIN public.products prod ON ((prod.id = pl.product_id)))
  GROUP BY p.id, p.code, p.name, pl.product_id, prod.name, prod.sku, pl.unit;


create or replace view "public"."production_item_statistics" as  WITH active_lot_stats AS (
         SELECT l.production_id,
            l.production_lot_id,
            li.product_id,
            li.unit,
            sum(COALESCE(li.initial_quantity, li.quantity)) AS total_qty,
            sum(li.quantity) AS current_qty,
            COALESCE(( SELECT pu.conversion_rate
                   FROM (public.product_units pu
                     JOIN public.units u ON ((u.id = pu.unit_id)))
                  WHERE ((pu.product_id = li.product_id) AND ((lower(TRIM(BOTH FROM u.name)) = lower(TRIM(BOTH FROM li.unit))) OR (lower(TRIM(BOTH FROM u.name)) = lower(TRIM(BOTH FROM regexp_replace(li.unit, '\s*\(.*\)'::text, ''::text))))))
                 LIMIT 1), NULLIF(p_1.weight_kg, (0)::numeric), public.extract_weight_from_unit(li.unit), 1.0) AS item_weight_factor
           FROM ((public.lot_items li
             JOIN public.lots l ON ((l.id = li.lot_id)))
             JOIN public.products p_1 ON ((p_1.id = li.product_id)))
          WHERE ((COALESCE(l.status, ''::text) <> 'deleted'::text) AND (l.production_id IS NOT NULL) AND (l.production_lot_id IS NOT NULL))
          GROUP BY l.production_id, l.production_lot_id, li.product_id, li.unit, p_1.weight_kg
        ), exported_lot_stats AS (
         SELECT l.production_id,
            l.production_lot_id,
            per_lot.product_id,
            per_lot.unit,
            sum(per_lot.lot_qty) AS total_qty,
            (0)::numeric AS current_qty,
            COALESCE(( SELECT pu.conversion_rate
                   FROM (public.product_units pu
                     JOIN public.units u ON ((u.id = pu.unit_id)))
                  WHERE ((pu.product_id = per_lot.product_id) AND ((lower(TRIM(BOTH FROM u.name)) = lower(TRIM(BOTH FROM per_lot.unit))) OR (lower(TRIM(BOTH FROM u.name)) = lower(TRIM(BOTH FROM regexp_replace(per_lot.unit, '\s*\(.*\)'::text, ''::text))))))
                 LIMIT 1), NULLIF(p_1.weight_kg, (0)::numeric), public.extract_weight_from_unit(per_lot.unit), 1.0) AS item_weight_factor
           FROM ((( SELECT DISTINCT ON (eti.lot_id, eti.product_id) eti.lot_id,
                    eti.product_id,
                    eti.quantity AS lot_qty,
                    eti.unit
                   FROM public.export_task_items eti
                  ORDER BY eti.lot_id, eti.product_id, eti.quantity DESC) per_lot
             JOIN public.lots l ON ((l.id = per_lot.lot_id)))
             JOIN public.products p_1 ON ((p_1.id = per_lot.product_id)))
          WHERE ((l.production_id IS NOT NULL) AND (l.production_lot_id IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
                   FROM public.lot_items li
                  WHERE (li.lot_id = l.id)))))
          GROUP BY l.production_id, l.production_lot_id, per_lot.product_id, per_lot.unit, p_1.weight_kg
        ), combined_stats AS (
         SELECT t.production_id,
            t.production_lot_id,
            t.product_id,
            t.unit,
            t.item_weight_factor,
            sum(t.total_qty) AS total_qty,
            sum(t.current_qty) AS current_qty
           FROM ( SELECT active_lot_stats.production_id,
                    active_lot_stats.production_lot_id,
                    active_lot_stats.product_id,
                    active_lot_stats.unit,
                    active_lot_stats.total_qty,
                    active_lot_stats.current_qty,
                    active_lot_stats.item_weight_factor
                   FROM active_lot_stats
                UNION ALL
                 SELECT exported_lot_stats.production_id,
                    exported_lot_stats.production_lot_id,
                    exported_lot_stats.product_id,
                    exported_lot_stats.unit,
                    exported_lot_stats.total_qty,
                    exported_lot_stats.current_qty,
                    exported_lot_stats.item_weight_factor
                   FROM exported_lot_stats) t
          GROUP BY t.production_id, t.production_lot_id, t.product_id, t.unit, t.item_weight_factor
        )
 SELECT pl.id AS production_lot_id,
    pl.production_id,
    p.id AS product_id,
    p.name AS product_name,
    p.sku AS product_sku,
    p.unit AS product_unit,
    ( SELECT COALESCE(sum((cs.total_qty * cs.item_weight_factor)), (0)::numeric) AS "coalesce"
           FROM combined_stats cs
          WHERE (cs.production_lot_id = pl.id)) AS actual_quantity,
    ( SELECT COALESCE(sum((cs.current_qty * cs.item_weight_factor)), (0)::numeric) AS "coalesce"
           FROM combined_stats cs
          WHERE (cs.production_lot_id = pl.id)) AS current_inventory,
    ( SELECT json_agg(json_build_object('qty', cs.total_qty, 'current_qty', cs.current_qty, 'unit',
                CASE
                    WHEN ((cs.unit !~~ '%(%)%'::text) AND (cs.item_weight_factor > (1)::numeric) AND (cs.item_weight_factor <> 1.0)) THEN (((cs.unit || ' ('::text) || round(cs.item_weight_factor, 2)) || 'kg)'::text)
                    ELSE cs.unit
                END) ORDER BY cs.total_qty DESC) AS json_agg
           FROM combined_stats cs
          WHERE (cs.production_lot_id = pl.id)) AS quantity_by_unit
   FROM (public.production_lots pl
     JOIN public.products p ON ((p.id = pl.product_id)));


CREATE OR REPLACE FUNCTION public.update_delivery_shifts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_delivery_sub_shifts_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."audit_logs" to "supabase_auth_admin";

grant insert on table "public"."audit_logs" to "supabase_auth_admin";

grant references on table "public"."audit_logs" to "supabase_auth_admin";

grant select on table "public"."audit_logs" to "supabase_auth_admin";

grant trigger on table "public"."audit_logs" to "supabase_auth_admin";

grant truncate on table "public"."audit_logs" to "supabase_auth_admin";

grant update on table "public"."audit_logs" to "supabase_auth_admin";

grant delete on table "public"."branches" to "supabase_auth_admin";

grant insert on table "public"."branches" to "supabase_auth_admin";

grant references on table "public"."branches" to "supabase_auth_admin";

grant select on table "public"."branches" to "supabase_auth_admin";

grant trigger on table "public"."branches" to "supabase_auth_admin";

grant truncate on table "public"."branches" to "supabase_auth_admin";

grant update on table "public"."branches" to "supabase_auth_admin";

grant delete on table "public"."categories" to "supabase_auth_admin";

grant insert on table "public"."categories" to "supabase_auth_admin";

grant references on table "public"."categories" to "supabase_auth_admin";

grant select on table "public"."categories" to "supabase_auth_admin";

grant trigger on table "public"."categories" to "supabase_auth_admin";

grant truncate on table "public"."categories" to "supabase_auth_admin";

grant update on table "public"."categories" to "supabase_auth_admin";

grant delete on table "public"."companies" to "supabase_auth_admin";

grant insert on table "public"."companies" to "supabase_auth_admin";

grant references on table "public"."companies" to "supabase_auth_admin";

grant select on table "public"."companies" to "supabase_auth_admin";

grant trigger on table "public"."companies" to "supabase_auth_admin";

grant truncate on table "public"."companies" to "supabase_auth_admin";

grant update on table "public"."companies" to "supabase_auth_admin";

grant delete on table "public"."company_settings" to "supabase_auth_admin";

grant insert on table "public"."company_settings" to "supabase_auth_admin";

grant references on table "public"."company_settings" to "supabase_auth_admin";

grant select on table "public"."company_settings" to "supabase_auth_admin";

grant trigger on table "public"."company_settings" to "supabase_auth_admin";

grant truncate on table "public"."company_settings" to "supabase_auth_admin";

grant update on table "public"."company_settings" to "supabase_auth_admin";

grant delete on table "public"."customers" to "supabase_auth_admin";

grant insert on table "public"."customers" to "supabase_auth_admin";

grant references on table "public"."customers" to "supabase_auth_admin";

grant select on table "public"."customers" to "supabase_auth_admin";

grant trigger on table "public"."customers" to "supabase_auth_admin";

grant truncate on table "public"."customers" to "supabase_auth_admin";

grant update on table "public"."customers" to "supabase_auth_admin";

grant delete on table "public"."export_tasks" to "anon";

grant insert on table "public"."export_tasks" to "anon";

grant references on table "public"."export_tasks" to "anon";

grant select on table "public"."export_tasks" to "anon";

grant trigger on table "public"."export_tasks" to "anon";

grant truncate on table "public"."export_tasks" to "anon";

grant update on table "public"."export_tasks" to "anon";

grant delete on table "public"."export_tasks" to "authenticated";

grant insert on table "public"."export_tasks" to "authenticated";

grant references on table "public"."export_tasks" to "authenticated";

grant select on table "public"."export_tasks" to "authenticated";

grant trigger on table "public"."export_tasks" to "authenticated";

grant truncate on table "public"."export_tasks" to "authenticated";

grant update on table "public"."export_tasks" to "authenticated";

grant delete on table "public"."export_tasks" to "service_role";

grant insert on table "public"."export_tasks" to "service_role";

grant references on table "public"."export_tasks" to "service_role";

grant select on table "public"."export_tasks" to "service_role";

grant trigger on table "public"."export_tasks" to "service_role";

grant truncate on table "public"."export_tasks" to "service_role";

grant update on table "public"."export_tasks" to "service_role";

grant delete on table "public"."inbound_order_items" to "supabase_auth_admin";

grant insert on table "public"."inbound_order_items" to "supabase_auth_admin";

grant references on table "public"."inbound_order_items" to "supabase_auth_admin";

grant select on table "public"."inbound_order_items" to "supabase_auth_admin";

grant trigger on table "public"."inbound_order_items" to "supabase_auth_admin";

grant truncate on table "public"."inbound_order_items" to "supabase_auth_admin";

grant update on table "public"."inbound_order_items" to "supabase_auth_admin";

grant delete on table "public"."inbound_orders" to "supabase_auth_admin";

grant insert on table "public"."inbound_orders" to "supabase_auth_admin";

grant references on table "public"."inbound_orders" to "supabase_auth_admin";

grant select on table "public"."inbound_orders" to "supabase_auth_admin";

grant trigger on table "public"."inbound_orders" to "supabase_auth_admin";

grant truncate on table "public"."inbound_orders" to "supabase_auth_admin";

grant update on table "public"."inbound_orders" to "supabase_auth_admin";

grant delete on table "public"."inventory_check_item_logs" to "anon";

grant insert on table "public"."inventory_check_item_logs" to "anon";

grant references on table "public"."inventory_check_item_logs" to "anon";

grant select on table "public"."inventory_check_item_logs" to "anon";

grant trigger on table "public"."inventory_check_item_logs" to "anon";

grant truncate on table "public"."inventory_check_item_logs" to "anon";

grant update on table "public"."inventory_check_item_logs" to "anon";

grant delete on table "public"."inventory_check_item_logs" to "authenticated";

grant insert on table "public"."inventory_check_item_logs" to "authenticated";

grant references on table "public"."inventory_check_item_logs" to "authenticated";

grant select on table "public"."inventory_check_item_logs" to "authenticated";

grant trigger on table "public"."inventory_check_item_logs" to "authenticated";

grant truncate on table "public"."inventory_check_item_logs" to "authenticated";

grant update on table "public"."inventory_check_item_logs" to "authenticated";

grant delete on table "public"."inventory_check_item_logs" to "service_role";

grant insert on table "public"."inventory_check_item_logs" to "service_role";

grant references on table "public"."inventory_check_item_logs" to "service_role";

grant select on table "public"."inventory_check_item_logs" to "service_role";

grant trigger on table "public"."inventory_check_item_logs" to "service_role";

grant truncate on table "public"."inventory_check_item_logs" to "service_role";

grant update on table "public"."inventory_check_item_logs" to "service_role";

grant delete on table "public"."inventory_check_items" to "supabase_auth_admin";

grant insert on table "public"."inventory_check_items" to "supabase_auth_admin";

grant references on table "public"."inventory_check_items" to "supabase_auth_admin";

grant select on table "public"."inventory_check_items" to "supabase_auth_admin";

grant trigger on table "public"."inventory_check_items" to "supabase_auth_admin";

grant truncate on table "public"."inventory_check_items" to "supabase_auth_admin";

grant update on table "public"."inventory_check_items" to "supabase_auth_admin";

grant delete on table "public"."inventory_checks" to "supabase_auth_admin";

grant insert on table "public"."inventory_checks" to "supabase_auth_admin";

grant references on table "public"."inventory_checks" to "supabase_auth_admin";

grant select on table "public"."inventory_checks" to "supabase_auth_admin";

grant trigger on table "public"."inventory_checks" to "supabase_auth_admin";

grant truncate on table "public"."inventory_checks" to "supabase_auth_admin";

grant update on table "public"."inventory_checks" to "supabase_auth_admin";

grant delete on table "public"."locations" to "supabase_auth_admin";

grant insert on table "public"."locations" to "supabase_auth_admin";

grant references on table "public"."locations" to "supabase_auth_admin";

grant select on table "public"."locations" to "supabase_auth_admin";

grant trigger on table "public"."locations" to "supabase_auth_admin";

grant truncate on table "public"."locations" to "supabase_auth_admin";

grant update on table "public"."locations" to "supabase_auth_admin";

grant delete on table "public"."lot_items" to "supabase_auth_admin";

grant insert on table "public"."lot_items" to "supabase_auth_admin";

grant references on table "public"."lot_items" to "supabase_auth_admin";

grant select on table "public"."lot_items" to "supabase_auth_admin";

grant trigger on table "public"."lot_items" to "supabase_auth_admin";

grant truncate on table "public"."lot_items" to "supabase_auth_admin";

grant update on table "public"."lot_items" to "supabase_auth_admin";

grant delete on table "public"."lot_tags" to "supabase_auth_admin";

grant insert on table "public"."lot_tags" to "supabase_auth_admin";

grant references on table "public"."lot_tags" to "supabase_auth_admin";

grant select on table "public"."lot_tags" to "supabase_auth_admin";

grant trigger on table "public"."lot_tags" to "supabase_auth_admin";

grant truncate on table "public"."lot_tags" to "supabase_auth_admin";

grant update on table "public"."lot_tags" to "supabase_auth_admin";

grant delete on table "public"."lots" to "supabase_auth_admin";

grant insert on table "public"."lots" to "supabase_auth_admin";

grant references on table "public"."lots" to "supabase_auth_admin";

grant select on table "public"."lots" to "supabase_auth_admin";

grant trigger on table "public"."lots" to "supabase_auth_admin";

grant truncate on table "public"."lots" to "supabase_auth_admin";

grant update on table "public"."lots" to "supabase_auth_admin";

grant delete on table "public"."master_tags" to "supabase_auth_admin";

grant insert on table "public"."master_tags" to "supabase_auth_admin";

grant references on table "public"."master_tags" to "supabase_auth_admin";

grant select on table "public"."master_tags" to "supabase_auth_admin";

grant trigger on table "public"."master_tags" to "supabase_auth_admin";

grant truncate on table "public"."master_tags" to "supabase_auth_admin";

grant update on table "public"."master_tags" to "supabase_auth_admin";

grant delete on table "public"."operational_notes" to "supabase_auth_admin";

grant insert on table "public"."operational_notes" to "supabase_auth_admin";

grant references on table "public"."operational_notes" to "supabase_auth_admin";

grant select on table "public"."operational_notes" to "supabase_auth_admin";

grant trigger on table "public"."operational_notes" to "supabase_auth_admin";

grant truncate on table "public"."operational_notes" to "supabase_auth_admin";

grant update on table "public"."operational_notes" to "supabase_auth_admin";

grant delete on table "public"."order_types" to "supabase_auth_admin";

grant insert on table "public"."order_types" to "supabase_auth_admin";

grant references on table "public"."order_types" to "supabase_auth_admin";

grant select on table "public"."order_types" to "supabase_auth_admin";

grant trigger on table "public"."order_types" to "supabase_auth_admin";

grant truncate on table "public"."order_types" to "supabase_auth_admin";

grant update on table "public"."order_types" to "supabase_auth_admin";

grant delete on table "public"."origins" to "supabase_auth_admin";

grant insert on table "public"."origins" to "supabase_auth_admin";

grant references on table "public"."origins" to "supabase_auth_admin";

grant select on table "public"."origins" to "supabase_auth_admin";

grant trigger on table "public"."origins" to "supabase_auth_admin";

grant truncate on table "public"."origins" to "supabase_auth_admin";

grant update on table "public"."origins" to "supabase_auth_admin";

grant delete on table "public"."outbound_order_items" to "supabase_auth_admin";

grant insert on table "public"."outbound_order_items" to "supabase_auth_admin";

grant references on table "public"."outbound_order_items" to "supabase_auth_admin";

grant select on table "public"."outbound_order_items" to "supabase_auth_admin";

grant trigger on table "public"."outbound_order_items" to "supabase_auth_admin";

grant truncate on table "public"."outbound_order_items" to "supabase_auth_admin";

grant update on table "public"."outbound_order_items" to "supabase_auth_admin";

grant delete on table "public"."outbound_orders" to "supabase_auth_admin";

grant insert on table "public"."outbound_orders" to "supabase_auth_admin";

grant references on table "public"."outbound_orders" to "supabase_auth_admin";

grant select on table "public"."outbound_orders" to "supabase_auth_admin";

grant trigger on table "public"."outbound_orders" to "supabase_auth_admin";

grant truncate on table "public"."outbound_orders" to "supabase_auth_admin";

grant update on table "public"."outbound_orders" to "supabase_auth_admin";

grant delete on table "public"."pending_assignments" to "anon";

grant insert on table "public"."pending_assignments" to "anon";

grant references on table "public"."pending_assignments" to "anon";

grant select on table "public"."pending_assignments" to "anon";

grant trigger on table "public"."pending_assignments" to "anon";

grant truncate on table "public"."pending_assignments" to "anon";

grant update on table "public"."pending_assignments" to "anon";

grant delete on table "public"."pending_assignments" to "authenticated";

grant insert on table "public"."pending_assignments" to "authenticated";

grant references on table "public"."pending_assignments" to "authenticated";

grant select on table "public"."pending_assignments" to "authenticated";

grant trigger on table "public"."pending_assignments" to "authenticated";

grant truncate on table "public"."pending_assignments" to "authenticated";

grant update on table "public"."pending_assignments" to "authenticated";

grant delete on table "public"."pending_assignments" to "service_role";

grant insert on table "public"."pending_assignments" to "service_role";

grant references on table "public"."pending_assignments" to "service_role";

grant select on table "public"."pending_assignments" to "service_role";

grant trigger on table "public"."pending_assignments" to "service_role";

grant truncate on table "public"."pending_assignments" to "service_role";

grant update on table "public"."pending_assignments" to "service_role";

grant delete on table "public"."permissions" to "supabase_auth_admin";

grant insert on table "public"."permissions" to "supabase_auth_admin";

grant references on table "public"."permissions" to "supabase_auth_admin";

grant select on table "public"."permissions" to "supabase_auth_admin";

grant trigger on table "public"."permissions" to "supabase_auth_admin";

grant truncate on table "public"."permissions" to "supabase_auth_admin";

grant update on table "public"."permissions" to "supabase_auth_admin";

grant delete on table "public"."positions" to "supabase_auth_admin";

grant insert on table "public"."positions" to "supabase_auth_admin";

grant references on table "public"."positions" to "supabase_auth_admin";

grant select on table "public"."positions" to "supabase_auth_admin";

grant trigger on table "public"."positions" to "supabase_auth_admin";

grant truncate on table "public"."positions" to "supabase_auth_admin";

grant update on table "public"."positions" to "supabase_auth_admin";

grant delete on table "public"."product_media" to "supabase_auth_admin";

grant insert on table "public"."product_media" to "supabase_auth_admin";

grant references on table "public"."product_media" to "supabase_auth_admin";

grant select on table "public"."product_media" to "supabase_auth_admin";

grant trigger on table "public"."product_media" to "supabase_auth_admin";

grant truncate on table "public"."product_media" to "supabase_auth_admin";

grant update on table "public"."product_media" to "supabase_auth_admin";

grant delete on table "public"."product_units" to "supabase_auth_admin";

grant insert on table "public"."product_units" to "supabase_auth_admin";

grant references on table "public"."product_units" to "supabase_auth_admin";

grant select on table "public"."product_units" to "supabase_auth_admin";

grant trigger on table "public"."product_units" to "supabase_auth_admin";

grant truncate on table "public"."product_units" to "supabase_auth_admin";

grant update on table "public"."product_units" to "supabase_auth_admin";

grant delete on table "public"."product_vehicle_compatibility" to "supabase_auth_admin";

grant insert on table "public"."product_vehicle_compatibility" to "supabase_auth_admin";

grant references on table "public"."product_vehicle_compatibility" to "supabase_auth_admin";

grant select on table "public"."product_vehicle_compatibility" to "supabase_auth_admin";

grant trigger on table "public"."product_vehicle_compatibility" to "supabase_auth_admin";

grant truncate on table "public"."product_vehicle_compatibility" to "supabase_auth_admin";

grant update on table "public"."product_vehicle_compatibility" to "supabase_auth_admin";

grant delete on table "public"."production_inputs" to "anon";

grant insert on table "public"."production_inputs" to "anon";

grant references on table "public"."production_inputs" to "anon";

grant select on table "public"."production_inputs" to "anon";

grant trigger on table "public"."production_inputs" to "anon";

grant truncate on table "public"."production_inputs" to "anon";

grant update on table "public"."production_inputs" to "anon";

grant delete on table "public"."production_inputs" to "authenticated";

grant insert on table "public"."production_inputs" to "authenticated";

grant references on table "public"."production_inputs" to "authenticated";

grant select on table "public"."production_inputs" to "authenticated";

grant trigger on table "public"."production_inputs" to "authenticated";

grant truncate on table "public"."production_inputs" to "authenticated";

grant update on table "public"."production_inputs" to "authenticated";

grant delete on table "public"."production_inputs" to "service_role";

grant insert on table "public"."production_inputs" to "service_role";

grant references on table "public"."production_inputs" to "service_role";

grant select on table "public"."production_inputs" to "service_role";

grant trigger on table "public"."production_inputs" to "service_role";

grant truncate on table "public"."production_inputs" to "service_role";

grant update on table "public"."production_inputs" to "service_role";

grant delete on table "public"."products" to "supabase_auth_admin";

grant insert on table "public"."products" to "supabase_auth_admin";

grant references on table "public"."products" to "supabase_auth_admin";

grant select on table "public"."products" to "supabase_auth_admin";

grant trigger on table "public"."products" to "supabase_auth_admin";

grant truncate on table "public"."products" to "supabase_auth_admin";

grant update on table "public"."products" to "supabase_auth_admin";

grant delete on table "public"."profiles" to "supabase_auth_admin";

grant insert on table "public"."profiles" to "supabase_auth_admin";

grant references on table "public"."profiles" to "supabase_auth_admin";

grant select on table "public"."profiles" to "supabase_auth_admin";

grant trigger on table "public"."profiles" to "supabase_auth_admin";

grant truncate on table "public"."profiles" to "supabase_auth_admin";

grant update on table "public"."profiles" to "supabase_auth_admin";

grant delete on table "public"."qc_info" to "supabase_auth_admin";

grant insert on table "public"."qc_info" to "supabase_auth_admin";

grant references on table "public"."qc_info" to "supabase_auth_admin";

grant select on table "public"."qc_info" to "supabase_auth_admin";

grant trigger on table "public"."qc_info" to "supabase_auth_admin";

grant truncate on table "public"."qc_info" to "supabase_auth_admin";

grant update on table "public"."qc_info" to "supabase_auth_admin";

grant delete on table "public"."roles" to "supabase_auth_admin";

grant insert on table "public"."roles" to "supabase_auth_admin";

grant references on table "public"."roles" to "supabase_auth_admin";

grant select on table "public"."roles" to "supabase_auth_admin";

grant trigger on table "public"."roles" to "supabase_auth_admin";

grant truncate on table "public"."roles" to "supabase_auth_admin";

grant update on table "public"."roles" to "supabase_auth_admin";

grant delete on table "public"."site_loans" to "supabase_auth_admin";

grant insert on table "public"."site_loans" to "supabase_auth_admin";

grant references on table "public"."site_loans" to "supabase_auth_admin";

grant select on table "public"."site_loans" to "supabase_auth_admin";

grant trigger on table "public"."site_loans" to "supabase_auth_admin";

grant truncate on table "public"."site_loans" to "supabase_auth_admin";

grant update on table "public"."site_loans" to "supabase_auth_admin";

grant delete on table "public"."suppliers" to "supabase_auth_admin";

grant insert on table "public"."suppliers" to "supabase_auth_admin";

grant references on table "public"."suppliers" to "supabase_auth_admin";

grant select on table "public"."suppliers" to "supabase_auth_admin";

grant trigger on table "public"."suppliers" to "supabase_auth_admin";

grant truncate on table "public"."suppliers" to "supabase_auth_admin";

grant update on table "public"."suppliers" to "supabase_auth_admin";

grant delete on table "public"."systems" to "supabase_auth_admin";

grant insert on table "public"."systems" to "supabase_auth_admin";

grant references on table "public"."systems" to "supabase_auth_admin";

grant select on table "public"."systems" to "supabase_auth_admin";

grant trigger on table "public"."systems" to "supabase_auth_admin";

grant truncate on table "public"."systems" to "supabase_auth_admin";

grant update on table "public"."systems" to "supabase_auth_admin";

grant delete on table "public"."units" to "supabase_auth_admin";

grant insert on table "public"."units" to "supabase_auth_admin";

grant references on table "public"."units" to "supabase_auth_admin";

grant select on table "public"."units" to "supabase_auth_admin";

grant trigger on table "public"."units" to "supabase_auth_admin";

grant truncate on table "public"."units" to "supabase_auth_admin";

grant update on table "public"."units" to "supabase_auth_admin";

grant delete on table "public"."user_profiles" to "supabase_auth_admin";

grant insert on table "public"."user_profiles" to "supabase_auth_admin";

grant references on table "public"."user_profiles" to "supabase_auth_admin";

grant select on table "public"."user_profiles" to "supabase_auth_admin";

grant trigger on table "public"."user_profiles" to "supabase_auth_admin";

grant truncate on table "public"."user_profiles" to "supabase_auth_admin";

grant update on table "public"."user_profiles" to "supabase_auth_admin";

grant delete on table "public"."vehicles" to "supabase_auth_admin";

grant insert on table "public"."vehicles" to "supabase_auth_admin";

grant references on table "public"."vehicles" to "supabase_auth_admin";

grant select on table "public"."vehicles" to "supabase_auth_admin";

grant trigger on table "public"."vehicles" to "supabase_auth_admin";

grant truncate on table "public"."vehicles" to "supabase_auth_admin";

grant update on table "public"."vehicles" to "supabase_auth_admin";

grant delete on table "public"."warehouse_layouts" to "anon";

grant insert on table "public"."warehouse_layouts" to "anon";

grant references on table "public"."warehouse_layouts" to "anon";

grant select on table "public"."warehouse_layouts" to "anon";

grant trigger on table "public"."warehouse_layouts" to "anon";

grant truncate on table "public"."warehouse_layouts" to "anon";

grant update on table "public"."warehouse_layouts" to "anon";

grant delete on table "public"."warehouse_layouts" to "authenticated";

grant insert on table "public"."warehouse_layouts" to "authenticated";

grant references on table "public"."warehouse_layouts" to "authenticated";

grant select on table "public"."warehouse_layouts" to "authenticated";

grant trigger on table "public"."warehouse_layouts" to "authenticated";

grant truncate on table "public"."warehouse_layouts" to "authenticated";

grant update on table "public"."warehouse_layouts" to "authenticated";

grant delete on table "public"."warehouse_layouts" to "service_role";

grant insert on table "public"."warehouse_layouts" to "service_role";

grant references on table "public"."warehouse_layouts" to "service_role";

grant select on table "public"."warehouse_layouts" to "service_role";

grant trigger on table "public"."warehouse_layouts" to "service_role";

grant truncate on table "public"."warehouse_layouts" to "service_role";

grant update on table "public"."warehouse_layouts" to "service_role";

grant delete on table "public"."warehouse_snapshots" to "anon";

grant insert on table "public"."warehouse_snapshots" to "anon";

grant references on table "public"."warehouse_snapshots" to "anon";

grant select on table "public"."warehouse_snapshots" to "anon";

grant trigger on table "public"."warehouse_snapshots" to "anon";

grant truncate on table "public"."warehouse_snapshots" to "anon";

grant update on table "public"."warehouse_snapshots" to "anon";

grant delete on table "public"."warehouse_snapshots" to "authenticated";

grant insert on table "public"."warehouse_snapshots" to "authenticated";

grant references on table "public"."warehouse_snapshots" to "authenticated";

grant select on table "public"."warehouse_snapshots" to "authenticated";

grant trigger on table "public"."warehouse_snapshots" to "authenticated";

grant truncate on table "public"."warehouse_snapshots" to "authenticated";

grant update on table "public"."warehouse_snapshots" to "authenticated";

grant delete on table "public"."warehouse_snapshots" to "service_role";

grant insert on table "public"."warehouse_snapshots" to "service_role";

grant references on table "public"."warehouse_snapshots" to "service_role";

grant select on table "public"."warehouse_snapshots" to "service_role";

grant trigger on table "public"."warehouse_snapshots" to "service_role";

grant truncate on table "public"."warehouse_snapshots" to "service_role";

grant update on table "public"."warehouse_snapshots" to "service_role";

grant delete on table "public"."warehouses" to "supabase_auth_admin";

grant insert on table "public"."warehouses" to "supabase_auth_admin";

grant references on table "public"."warehouses" to "supabase_auth_admin";

grant select on table "public"."warehouses" to "supabase_auth_admin";

grant trigger on table "public"."warehouses" to "supabase_auth_admin";

grant truncate on table "public"."warehouses" to "supabase_auth_admin";

grant update on table "public"."warehouses" to "supabase_auth_admin";

grant delete on table "public"."zone_layouts" to "supabase_auth_admin";

grant insert on table "public"."zone_layouts" to "supabase_auth_admin";

grant references on table "public"."zone_layouts" to "supabase_auth_admin";

grant select on table "public"."zone_layouts" to "supabase_auth_admin";

grant trigger on table "public"."zone_layouts" to "supabase_auth_admin";

grant truncate on table "public"."zone_layouts" to "supabase_auth_admin";

grant update on table "public"."zone_layouts" to "supabase_auth_admin";

grant delete on table "public"."zone_positions" to "supabase_auth_admin";

grant insert on table "public"."zone_positions" to "supabase_auth_admin";

grant references on table "public"."zone_positions" to "supabase_auth_admin";

grant select on table "public"."zone_positions" to "supabase_auth_admin";

grant trigger on table "public"."zone_positions" to "supabase_auth_admin";

grant truncate on table "public"."zone_positions" to "supabase_auth_admin";

grant update on table "public"."zone_positions" to "supabase_auth_admin";

grant delete on table "public"."zone_status_layouts" to "supabase_auth_admin";

grant insert on table "public"."zone_status_layouts" to "supabase_auth_admin";

grant references on table "public"."zone_status_layouts" to "supabase_auth_admin";

grant select on table "public"."zone_status_layouts" to "supabase_auth_admin";

grant trigger on table "public"."zone_status_layouts" to "supabase_auth_admin";

grant truncate on table "public"."zone_status_layouts" to "supabase_auth_admin";

grant update on table "public"."zone_status_layouts" to "supabase_auth_admin";

grant delete on table "public"."zone_templates" to "supabase_auth_admin";

grant insert on table "public"."zone_templates" to "supabase_auth_admin";

grant references on table "public"."zone_templates" to "supabase_auth_admin";

grant select on table "public"."zone_templates" to "supabase_auth_admin";

grant trigger on table "public"."zone_templates" to "supabase_auth_admin";

grant truncate on table "public"."zone_templates" to "supabase_auth_admin";

grant update on table "public"."zone_templates" to "supabase_auth_admin";

grant delete on table "public"."zones" to "supabase_auth_admin";

grant insert on table "public"."zones" to "supabase_auth_admin";

grant references on table "public"."zones" to "supabase_auth_admin";

grant select on table "public"."zones" to "supabase_auth_admin";

grant trigger on table "public"."zones" to "supabase_auth_admin";

grant truncate on table "public"."zones" to "supabase_auth_admin";

grant update on table "public"."zones" to "supabase_auth_admin";


  create policy "Allow insert/update for same system_code on box_labels"
  on "public"."box_labels"
  as permissive
  for all
  to public
using (true);



  create policy "Allow select for same system_code on box_labels"
  on "public"."box_labels"
  as permissive
  for select
  to public
using (true);



  create policy "Category Isolation Select"
  on "public"."categories"
  as permissive
  for select
  to authenticated
using (((company_id IS NULL) OR (company_id = ( SELECT user_profiles.company_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))));



  create policy "Category Strict Delete"
  on "public"."categories"
  as permissive
  for delete
  to authenticated
using (((company_id = ( SELECT user_profiles.company_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND ((( SELECT user_profiles.account_level
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))))));



  create policy "Category Strict Insert"
  on "public"."categories"
  as permissive
  for insert
  to authenticated
with check (((company_id = ( SELECT user_profiles.company_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND ((( SELECT user_profiles.account_level
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))))));



  create policy "Category Strict Update"
  on "public"."categories"
  as permissive
  for update
  to authenticated
using (((company_id = ( SELECT user_profiles.company_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND ((( SELECT user_profiles.account_level
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))))))
with check (((company_id = ( SELECT user_profiles.company_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND ((( SELECT user_profiles.account_level
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))))));



  create policy "Public can find company by domain"
  on "public"."companies"
  as permissive
  for select
  to public
using (true);



  create policy "settings_insert"
  on "public"."company_settings"
  as permissive
  for insert
  to public
with check ((auth.uid() IN ( SELECT user_profiles.id
   FROM public.user_profiles)));



  create policy "settings_manage"
  on "public"."company_settings"
  as permissive
  for all
  to public
using (((auth.jwt() ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));



  create policy "settings_select"
  on "public"."company_settings"
  as permissive
  for select
  to public
using (((id = public.get_my_company_id()) OR ((auth.jwt() ->> 'email'::text) = 'tungdibui2609@gmail.com'::text)));



  create policy "settings_select_debug"
  on "public"."company_settings"
  as permissive
  for select
  to authenticated
using (true);



  create policy "settings_update_debug"
  on "public"."company_settings"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "Enable all for authenticated users items"
  on "public"."export_task_items"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Enable all for authenticated users"
  on "public"."export_tasks"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Users can insert logs for their company"
  on "public"."inventory_check_item_logs"
  as permissive
  for insert
  to public
with check ((company_id = public.get_user_company_id()));



  create policy "Users can view logs of their company"
  on "public"."inventory_check_item_logs"
  as permissive
  for select
  to public
using ((company_id = public.get_user_company_id()));



  create policy "Allow insert pending assignments"
  on "public"."pending_assignments"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow select pending assignments"
  on "public"."pending_assignments"
  as permissive
  for select
  to public
using (true);



  create policy "Cho phép cập nhật trạng thái duyệt"
  on "public"."pending_assignments"
  as permissive
  for update
  to public
using (true);



  create policy "Cho phép nhân viên gán vị trí từ mobile"
  on "public"."pending_assignments"
  as permissive
  for insert
  to public
with check (true);



  create policy "Cho phép xem danh sách chờ duyệt"
  on "public"."pending_assignments"
  as permissive
  for select
  to public
using (true);



  create policy "Cho phép xóa bản ghi lỗi"
  on "public"."pending_assignments"
  as permissive
  for delete
  to public
using (true);



  create policy "allow_read_permissions_all"
  on "public"."permissions"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users can read position_history for KHO_DONG_LANH"
  on "public"."position_history"
  as permissive
  for select
  to public
using ((system_code = 'KHO_DONG_LANH'::text));



  create policy "Users can read position_history for KHO_DUNG_CU"
  on "public"."position_history"
  as permissive
  for select
  to public
using ((system_code = 'KHO_DUNG_CU'::text));



  create policy "Users can read position_history for KHO_NGUYEN_VAT_LIEU"
  on "public"."position_history"
  as permissive
  for select
  to public
using ((system_code = 'KHO_NGUYEN_VAT_LIEU'::text));



  create policy "Users can read position_history for KHO_VAT_TU_BAO_BI"
  on "public"."position_history"
  as permissive
  for select
  to public
using ((system_code = 'KHO_VAT_TU_BAO_BI'::text));



  create policy "allow_read_roles"
  on "public"."roles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "roles_manage_all"
  on "public"."roles"
  as permissive
  for all
  to service_role
using (true);



  create policy "roles_read_all"
  on "public"."roles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Enable all for users"
  on "public"."site_loans"
  as permissive
  for all
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Enable delete for admins"
  on "public"."systems"
  as permissive
  for delete
  to authenticated
using ((( SELECT user_profiles.account_level
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY[1, 2])));



  create policy "Enable insert for admins"
  on "public"."systems"
  as permissive
  for insert
  to authenticated
with check ((( SELECT user_profiles.account_level
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY[1, 2])));



  create policy "Enable update for admins"
  on "public"."systems"
  as permissive
  for update
  to authenticated
using ((( SELECT user_profiles.account_level
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY[1, 2])))
with check ((( SELECT user_profiles.account_level
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY[1, 2])));



  create policy "systems_manage"
  on "public"."systems"
  as permissive
  for all
  to public
using (((auth.jwt() ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));



  create policy "systems_select"
  on "public"."systems"
  as permissive
  for select
  to public
using (((company_id = public.get_my_company_id()) OR ((auth.jwt() ->> 'email'::text) = 'tungdibui2609@gmail.com'::text)));



  create policy "Unit Isolation Select"
  on "public"."units"
  as permissive
  for select
  to authenticated
using (((company_id IS NULL) OR (company_id = ( SELECT user_profiles.company_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))));



  create policy "Unit Strict Delete"
  on "public"."units"
  as permissive
  for delete
  to authenticated
using (((company_id = ( SELECT user_profiles.company_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND ((( SELECT user_profiles.account_level
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))))));



  create policy "Unit Strict Insert"
  on "public"."units"
  as permissive
  for insert
  to authenticated
with check (((company_id = ( SELECT user_profiles.company_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND ((( SELECT user_profiles.account_level
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))))));



  create policy "Unit Strict Update"
  on "public"."units"
  as permissive
  for update
  to authenticated
using (((company_id = ( SELECT user_profiles.company_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND ((( SELECT user_profiles.account_level
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))))))
with check (((company_id = ( SELECT user_profiles.company_id
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid()))) AND ((( SELECT user_profiles.account_level
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())))))));



  create policy "Allow update users"
  on "public"."user_profiles"
  as permissive
  for update
  to public
using (((( SELECT user_profiles_1.account_level
   FROM public.user_profiles user_profiles_1
  WHERE (user_profiles_1.id = auth.uid())) = 1) OR ((( SELECT user_profiles_1.account_level
   FROM public.user_profiles user_profiles_1
  WHERE (user_profiles_1.id = auth.uid())) = 2) AND (company_id = ( SELECT user_profiles_1.company_id
   FROM public.user_profiles user_profiles_1
  WHERE (user_profiles_1.id = auth.uid())))) OR (auth.uid() = id)));



  create policy "Enable read access for authenticated users"
  on "public"."user_profiles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "authenticated_read_all"
  on "public"."user_profiles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "authenticated_update_own"
  on "public"."user_profiles"
  as permissive
  for update
  to authenticated
using ((id = auth.uid()));



  create policy "service_role_all"
  on "public"."user_profiles"
  as permissive
  for all
  to service_role
using (true);



  create policy "Cho phép tất cả thao tác trên warehouse_layouts"
  on "public"."warehouse_layouts"
  as permissive
  for all
  to public
using (true);



  create policy "Allow all actions for authenticated users"
  on "public"."zone_status_layouts"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Enable read access for all users"
  on "public"."systems"
  as permissive
  for select
  to authenticated
using (true);


CREATE TRIGGER on_branch_name_change AFTER UPDATE OF name ON public.branches FOR EACH ROW EXECUTE FUNCTION public.handle_branch_rename();

CREATE TRIGGER trg_new_lot_item_initial_quantity BEFORE INSERT ON public.lot_items FOR EACH ROW EXECUTE FUNCTION public.handle_new_lot_item_initial_quantity();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Auth Delete Company Assets"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'company-assets'::text));



  create policy "Auth Manage Company Assets"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'company-assets'::text));



  create policy "Auth Upload Company Assets"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'company-assets'::text));



  create policy "Authenticated Delete Company Assets"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'company-assets'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated Update Company Assets"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'company-assets'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated Upload Company Assets"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'company-assets'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Public Access Company Assets"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'company-assets'::text));



  create policy "Public Read Company Assets"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'company-assets'::text));



