-- ============================================================================
-- GÓI 6: KHÓA QUYỀN EXECUTE HÀM SECURITY DEFINER CHO ANON & CHẶN LISTING STORAGE
-- 1. Thu hồi quyền EXECUTE từ PUBLIC & anon trên 27 hàm SECURITY DEFINER
--    (GIỮ LẠI get_user_email_by_username cho màn hình /login bằng username).
-- 2. Đổi policy SELECT trên storage.objects sang TO authenticated để tắt cảnh báo
--    'Public Bucket Allows Listing' (URL ảnh public vẫn hiển thị bình thường).
-- ============================================================================

BEGIN;

-- 1. Thu hồi EXECUTE từ PUBLIC, anon và cấp cho authenticated, service_role
REVOKE ALL ON FUNCTION "public"."approve_inventory_check"(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."approve_inventory_check"(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."capture_daily_position_snapshot"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."capture_daily_position_snapshot"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."check_position_lot_lock"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."check_position_lot_lock"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."copy_default_roles_to_new_company"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."copy_default_roles_to_new_company"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."copy_defaults_to_new_company"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."copy_defaults_to_new_company"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."fn_audit_delivery_journal_trigger"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."fn_audit_delivery_journal_trigger"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."fn_audit_delivery_shifts_trigger"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."fn_audit_delivery_shifts_trigger"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."fn_audit_lot_items_trigger"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."fn_audit_lot_items_trigger"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."fn_audit_lots_trigger"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."fn_audit_lots_trigger"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."fn_audit_orders_trigger"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."fn_audit_orders_trigger"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."fn_audit_positions_trigger"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."fn_audit_positions_trigger"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."fn_audit_shift_tasks_trigger"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."fn_audit_shift_tasks_trigger"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."fn_register_master_tag_from_lot_tag"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."fn_register_master_tag_from_lot_tag"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."get_lot_ids_in_zone"(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."get_lot_ids_in_zone"(text, text[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."get_my_company_id"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."get_my_company_id"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."get_position_history"(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."get_position_history"(text, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."get_snapshot_dates"(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."get_snapshot_dates"(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."get_user_company_id"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."get_user_company_id"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."handle_branch_rename"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."handle_branch_rename"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."handle_lot_lock_change"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."handle_lot_lock_change"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."is_module_active"(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."is_module_active"(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."issue_production_loan_fifo"(uuid, text, numeric, text, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."issue_production_loan_fifo"(uuid, text, numeric, text, text, uuid, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."issue_production_loan_fifo"(uuid, text, numeric, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."issue_production_loan_fifo"(uuid, text, numeric, text, text, uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."issue_production_loan_fifo"(uuid, text, numeric, text, text, uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."issue_production_loan_fifo"(uuid, text, numeric, text, text, uuid, text, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."sync_lot_dates_from_boxes"(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."sync_lot_dates_from_boxes"(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION "public"."trigger_sync_lot_dates_on_box_change"() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION "public"."trigger_sync_lot_dates_on_box_change"() TO authenticated, service_role;

-- 2. Chặn anon list danh sách file trên storage.objects (đổi SELECT sang TO authenticated)
DROP POLICY IF EXISTS "Public Access Company Assets" ON "storage"."objects";
DROP POLICY IF EXISTS "Public Read Company Assets" ON "storage"."objects";
DROP POLICY IF EXISTS "Authenticated Delete Company Assets" ON "storage"."objects";
DROP POLICY IF EXISTS "Authenticated Update Company Assets" ON "storage"."objects";
DROP POLICY IF EXISTS "Authenticated Upload Company Assets" ON "storage"."objects";
CREATE POLICY "Auth Read Company Assets" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'company-assets'::"text"));

DROP POLICY IF EXISTS "Public Access to Note Attachments" ON "storage"."objects";
CREATE POLICY "Auth Read Note Attachments" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'note-attachments'::"text"));

DROP POLICY IF EXISTS "Public Read Operation Images" ON "storage"."objects";
CREATE POLICY "Auth Read Operation Images" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'operation-images'::"text"));

COMMIT;
