-- ============================================================================
-- GÓI 5: DỌN SẠCH CẢNH BÁO VÀNG 'Multiple Permissive Policies'
-- Nguyên tắc: Chỉ xóa/gộp các PERMISSIVE policy bị trùng hoặc bị bao trùm 100%.
-- Giữ nguyên toàn bộ RESTRICTIVE policy (Strict Tenant Boundary) và giữ nguyên
-- 100% quyền hiệu lực của mọi tài khoản.
-- ============================================================================

BEGIN;

-- box_label_print_logs: giữ 1 policy ALL (Allow insert for same system_code on print_logs) đã bao trùm toàn bộ
ALTER POLICY "Allow insert for same system_code on print_logs" ON "public"."box_label_print_logs" USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow delete for same system_code on print_logs" ON "public"."box_label_print_logs";
DROP POLICY IF EXISTS "Allow select for same system_code on print_logs" ON "public"."box_label_print_logs";

-- box_labels: giữ 1 policy ALL (Allow insert/update for same system_code) đã bao trùm toàn bộ
ALTER POLICY "Allow insert/update for same system_code" ON "public"."box_labels" USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow insert/update for same system_code on box_labels" ON "public"."box_labels";
DROP POLICY IF EXISTS "Allow delete for same system_code on box_labels" ON "public"."box_labels";
DROP POLICY IF EXISTS "Allow select for same system_code" ON "public"."box_labels";
DROP POLICY IF EXISTS "Allow select for same system_code on box_labels" ON "public"."box_labels";

-- branches: giữ 1 policy ALL authenticated (Allow all access to branches for authenticated users) đã bao trùm toàn bộ
DROP POLICY IF EXISTS "Permissive Access" ON "public"."branches";

-- categories: giữ 1 policy ALL (Enable access for all users) đã bao trùm toàn bộ
DROP POLICY IF EXISTS "Superuser Bypass Policy" ON "public"."categories";
DROP POLICY IF EXISTS "Tenant Permissive Policy" ON "public"."categories";
DROP POLICY IF EXISTS "Category Strict Delete" ON "public"."categories";
DROP POLICY IF EXISTS "Category Strict Insert" ON "public"."categories";
DROP POLICY IF EXISTS "Category Isolation Select" ON "public"."categories";
DROP POLICY IF EXISTS "Category Strict Update" ON "public"."categories";

-- customers: gộp Tenant Permissive Policy + Superuser Bypass Policy thành 1 policy authenticated
DROP POLICY IF EXISTS "Superuser Bypass Policy" ON "public"."customers";
DROP POLICY IF EXISTS "Tenant Permissive Policy" ON "public"."customers";
CREATE POLICY "Tenant Permissive Policy" ON "public"."customers" FOR ALL TO "authenticated" USING (true) WITH CHECK (true);

-- locations: giữ 1 policy ALL (Enable access for all users) đã bao trùm toàn bộ
DROP POLICY IF EXISTS "Permissive Access" ON "public"."locations";

-- lots: giữ 1 policy ALL authenticated (Permissive Access) đã bao trùm toàn bộ
ALTER POLICY "Permissive Access" ON "public"."lots" USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable delete for all users" ON "public"."lots";
DROP POLICY IF EXISTS "Enable insert for all users" ON "public"."lots";
DROP POLICY IF EXISTS "allow_select_on_lots" ON "public"."lots";
DROP POLICY IF EXISTS "Enable update for all users" ON "public"."lots";

-- permissions: giữ 1 policy ALL authenticated (Permissive Access) đã bao trùm toàn bộ
ALTER POLICY "Permissive Access" ON "public"."permissions" USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable write access for admins only" ON "public"."permissions";
DROP POLICY IF EXISTS "allow_read_permissions_all" ON "public"."permissions";

-- product_units: giữ 1 policy ALL authenticated (Permissive Access) đã bao trùm toàn bộ
ALTER POLICY "Permissive Access" ON "public"."product_units" USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON "public"."product_units";
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON "public"."product_units";
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."product_units";
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON "public"."product_units";

-- products: giữ 1 policy ALL (Enable access for all users) đã bao trùm toàn bộ
DROP POLICY IF EXISTS "Superuser Bypass Policy" ON "public"."products";
DROP POLICY IF EXISTS "Tenant Permissive Policy" ON "public"."products";
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."products";

-- roles: giữ 1 policy ALL authenticated (Permissive Access) đã bao trùm toàn bộ
ALTER POLICY "Permissive Access" ON "public"."roles" USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_read_roles" ON "public"."roles";
DROP POLICY IF EXISTS "roles_read_all" ON "public"."roles";

-- stamp_dictionaries: giữ 1 policy ALL authenticated (Allow manage stamp_dictionaries for authenticated users) đã bao trùm toàn bộ
DROP POLICY IF EXISTS "Allow read stamp_dictionaries for all users" ON "public"."stamp_dictionaries";

-- stamp_formats: giữ 1 policy ALL authenticated (Allow manage stamp_formats for authenticated users) đã bao trùm toàn bộ
DROP POLICY IF EXISTS "Allow read stamp_formats for all users" ON "public"."stamp_formats";

-- user_profiles: xóa policy SELECT trùng và UPDATE bị bao trùm
DROP POLICY IF EXISTS "authenticated_read_all" ON "public"."user_profiles";
DROP POLICY IF EXISTS "authenticated_update_own" ON "public"."user_profiles";

-- vehicles: gộp Tenant Permissive Policy + Superuser Bypass Policy thành 1 policy authenticated
DROP POLICY IF EXISTS "Superuser Bypass Policy" ON "public"."vehicles";
DROP POLICY IF EXISTS "Tenant Permissive Policy" ON "public"."vehicles";
CREATE POLICY "Tenant Permissive Policy" ON "public"."vehicles" FOR ALL TO "authenticated" USING (true) WITH CHECK (true);

-- warehouses: giữ 1 policy ALL (Enable access for all users) đã bao trùm toàn bộ
DROP POLICY IF EXISTS "Permissive Access" ON "public"."warehouses";

-- zone_layouts: giữ 1 policy ALL (Allow all for zone_layouts) đã bao trùm toàn bộ
DROP POLICY IF EXISTS "Permissive Access" ON "public"."zone_layouts";

-- zones: giữ 1 policy ALL (Allow all for zones) đã bao trùm toàn bộ
DROP POLICY IF EXISTS "Permissive Access" ON "public"."zones";

-- ============================================================================
-- PHẦN 2: DỌN NỐT 15 BẢNG CÓ POLICY CHỒNG CHÉO (TÁCH RIÊNG THEO TỪNG CMD)
-- ============================================================================

-- companies: giữ đọc public theo domain, tách quyền quản lý của superadmin sang INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Authenticated users can read companies" ON "public"."companies";
DROP POLICY IF EXISTS "Public read companies" ON "public"."companies";
DROP POLICY IF EXISTS "Superuser Bypass Policy" ON "public"."companies";
DROP POLICY IF EXISTS "Superadmins can manage companies" ON "public"."companies";
CREATE POLICY "Superadmins can insert companies" ON "public"."companies" FOR INSERT TO "authenticated"
  WITH CHECK ((((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text") OR (EXISTS (SELECT 1 FROM "public"."user_profiles" WHERE ("id" = (SELECT "auth"."uid"()) AND "account_level" = 1))));
CREATE POLICY "Superadmins can update companies" ON "public"."companies" FOR UPDATE TO "authenticated"
  USING ((((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text") OR (EXISTS (SELECT 1 FROM "public"."user_profiles" WHERE ("id" = (SELECT "auth"."uid"()) AND "account_level" = 1))));
CREATE POLICY "Superadmins can delete companies" ON "public"."companies" FOR DELETE TO "authenticated"
  USING ((((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text") OR (EXISTS (SELECT 1 FROM "public"."user_profiles" WHERE ("id" = (SELECT "auth"."uid"()) AND "account_level" = 1))));

-- company_settings: mỗi action đúng 1 policy
DROP POLICY IF EXISTS "settings_select" ON "public"."company_settings";
DROP POLICY IF EXISTS "settings_manage" ON "public"."company_settings";
CREATE POLICY "settings_delete" ON "public"."company_settings" FOR DELETE TO "authenticated"
  USING (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text");

-- inbound_orders: giữ đọc mở + ghi cho authenticated (mỗi cmd 1 policy)
DROP POLICY IF EXISTS "Superuser Bypass Policy" ON "public"."inbound_orders";
DROP POLICY IF EXISTS "Tenant Permissive Policy" ON "public"."inbound_orders";

-- outbound_orders: giữ đọc mở + ghi cho authenticated (mỗi cmd 1 policy)
DROP POLICY IF EXISTS "Superuser Bypass Policy" ON "public"."outbound_orders";
DROP POLICY IF EXISTS "Tenant Permissive Policy" ON "public"."outbound_orders";

-- internal_product_code_rules: giữ SELECT public + ghi cho authenticated
DROP POLICY IF EXISTS "Enable all for authenticated users" ON "public"."internal_product_code_rules";
CREATE POLICY "Enable insert for authenticated users" ON "public"."internal_product_code_rules" FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON "public"."internal_product_code_rules" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users" ON "public"."internal_product_code_rules" FOR DELETE TO "authenticated" USING (true);

-- operational_notes: giữ SELECT public + ghi cho authenticated
DROP POLICY IF EXISTS "Superuser Bypass Policy" ON "public"."operational_notes";
DROP POLICY IF EXISTS "Tenant Permissive Policy" ON "public"."operational_notes";
DROP POLICY IF EXISTS "Enable delete for own notes" ON "public"."operational_notes";
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "public"."operational_notes";
DROP POLICY IF EXISTS "Enable update for own notes" ON "public"."operational_notes";
CREATE POLICY "Enable insert for authenticated users" ON "public"."operational_notes" FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON "public"."operational_notes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users" ON "public"."operational_notes" FOR DELETE TO "authenticated" USING (true);

-- pending_assignments: xóa 2 bản trùng tiếng Anh
DROP POLICY IF EXISTS "Allow insert pending assignments" ON "public"."pending_assignments";
DROP POLICY IF EXISTS "Allow select pending assignments" ON "public"."pending_assignments";

-- position_history: xóa 4 policy theo kho bị bao trùm bởi Fallback read
DROP POLICY IF EXISTS "Users can read position_history for KHO_DONG_LANH" ON "public"."position_history";
DROP POLICY IF EXISTS "Users can read position_history for KHO_DUNG_CU" ON "public"."position_history";
DROP POLICY IF EXISTS "Users can read position_history for KHO_NGUYEN_VAT_LIEU" ON "public"."position_history";
DROP POLICY IF EXISTS "Users can read position_history for KHO_VAT_TU_BAO_BI" ON "public"."position_history";

-- product_category_rel: xóa SELECT trùng với ALL
DROP POLICY IF EXISTS "Users can view product category relations of their company and " ON "public"."product_category_rel";

-- qc_info: bỏ Superuser Bypass & Tenant Permissive ALL vì đã có 4 policy riêng
DROP POLICY IF EXISTS "Superuser Bypass Policy" ON "public"."qc_info";
DROP POLICY IF EXISTS "Tenant Permissive Policy" ON "public"."qc_info";

-- site_loans: gộp 2 policy ALL trùng thành 1
DROP POLICY IF EXISTS "Enable all for users" ON "public"."site_loans";

-- suppliers: bỏ Superuser Bypass & Tenant Permissive ALL vì đã có 4 policy riêng
DROP POLICY IF EXISTS "Superuser Bypass Policy" ON "public"."suppliers";
DROP POLICY IF EXISTS "Tenant Permissive Policy" ON "public"."suppliers";

-- systems: giữ SELECT + gộp superuser vào insert/update/delete cho admins
DROP POLICY IF EXISTS "systems_select" ON "public"."systems";
DROP POLICY IF EXISTS "systems_manage" ON "public"."systems";
ALTER POLICY "Enable insert for admins" ON "public"."systems"
  WITH CHECK ((((SELECT "user_profiles"."account_level" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))) = ANY (ARRAY[1, 2])) OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")));
ALTER POLICY "Enable update for admins" ON "public"."systems"
  USING ((((SELECT "user_profiles"."account_level" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))) = ANY (ARRAY[1, 2])) OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")))
  WITH CHECK ((((SELECT "user_profiles"."account_level" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))) = ANY (ARRAY[1, 2])) OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")));
ALTER POLICY "Enable delete for admins" ON "public"."systems"
  USING ((((SELECT "user_profiles"."account_level" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))) = ANY (ARRAY[1, 2])) OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")));

-- units: giữ SELECT public + ghi cho authenticated (mỗi cmd 1 policy)
DROP POLICY IF EXISTS "Superuser Bypass Policy" ON "public"."units";
DROP POLICY IF EXISTS "Tenant Permissive Policy" ON "public"."units";
DROP POLICY IF EXISTS "Unit Strict Delete" ON "public"."units";
DROP POLICY IF EXISTS "Unit Strict Insert" ON "public"."units";
DROP POLICY IF EXISTS "Unit Strict Update" ON "public"."units";
DROP POLICY IF EXISTS "Unit Isolation Select" ON "public"."units";

-- platform_modules: tách Super Admin ALL thành INSERT/UPDATE/DELETE để không chồng SELECT
DROP POLICY IF EXISTS "Super Admin can manage platform_modules" ON "public"."platform_modules";
CREATE POLICY "Super Admin can insert platform_modules" ON "public"."platform_modules" FOR INSERT TO "authenticated"
  WITH CHECK (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text");
CREATE POLICY "Super Admin can update platform_modules" ON "public"."platform_modules" FOR UPDATE TO "authenticated"
  USING (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text");
CREATE POLICY "Super Admin can delete platform_modules" ON "public"."platform_modules" FOR DELETE TO "authenticated"
  USING (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text");

-- system_ui_settings: tách write ALL thành INSERT/UPDATE/DELETE để không chồng SELECT
DROP POLICY IF EXISTS "system_ui_settings_write_authenticated" ON "public"."system_ui_settings";
CREATE POLICY "system_ui_settings_insert_authenticated" ON "public"."system_ui_settings" FOR INSERT TO "authenticated" WITH CHECK (true);
CREATE POLICY "system_ui_settings_update_authenticated" ON "public"."system_ui_settings" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);
CREATE POLICY "system_ui_settings_delete_authenticated" ON "public"."system_ui_settings" FOR DELETE TO "authenticated" USING (true);

COMMIT;
