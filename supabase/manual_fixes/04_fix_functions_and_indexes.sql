-- ============================================================================
-- GÓI 4: XỬ LÝ CẢNH BÁO VÀNG 'Function Search Path Mutable' & 'Duplicate Index'
-- 1. Cố định search_path = public cho toàn bộ hàm trong schema public.
-- 2. Xóa index trùng lặp (không phải constraint) trên public.
-- ============================================================================

BEGIN;

ALTER FUNCTION "public"."approve_inventory_check"(p_check_id uuid, p_reviewer_id uuid) SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."check_position_lot_lock"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."copy_default_roles_to_new_company"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."copy_defaults_to_new_company"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."ensure_single_default_branch"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."extract_weight_from_unit"(unit_name text) SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."fn_set_initial_quantity"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."generate_delivery_code"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."get_lot_ids_in_zone"(p_system_code text, p_zone_ids text[]) SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."get_unassigned_lots"(p_system_code text) SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."get_user_company_id"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."get_user_email_by_username"(p_username text) SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."handle_branch_rename"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."handle_lot_lock_change"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."handle_new_lot_item_initial_quantity"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."handle_new_user"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."is_module_active"(p_company_id uuid, p_module_code text) SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."issue_production_loan_fifo"(p_product_id uuid, p_worker_name text, p_total_quantity numeric, p_unit text, p_system_code text, p_production_id uuid, p_notes text, p_tag text, p_batch_id uuid) SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."issue_production_loan_fifo"(p_product_id uuid, p_worker_name text, p_total_quantity numeric, p_unit text, p_system_code text, p_production_id uuid, p_notes text) SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."issue_production_loan_fifo"(p_product_id uuid, p_worker_name text, p_total_quantity numeric, p_unit text, p_system_code text, p_production_id uuid, p_notes text, p_tag text) SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."parse_date_to_iso"(date_str text) SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."sync_lot_dates_from_boxes"(target_lot_id uuid) SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."trigger_sync_lot_dates_on_box_change"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."update_delivery_journal_updated_at"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."update_delivery_shifts_updated_at"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."update_delivery_sub_shifts_updated_at"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."update_handover_updated_at"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."update_shift_tasks_updated_at"() SET "search_path" = "public", "extensions", "pg_temp";
ALTER FUNCTION "public"."update_updated_at_column"() SET "search_path" = "public", "extensions", "pg_temp";

DROP INDEX IF EXISTS "public"."idx_delivery_settings_production_lot_id";
DROP INDEX IF EXISTS "public"."idx_ds_lot_id";
DROP INDEX IF EXISTS "public"."idx_ds_mo_id";

COMMIT;
