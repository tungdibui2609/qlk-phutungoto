-- ============================================================================
-- GÓI 3: TỐI ƯU TOÀN BỘ CẢNH BÁO VÀNG 'Auth RLS Initialization Plan'
-- Bọc toàn bộ auth.uid(), auth.role(), auth.jwt() chưa bọc thành (SELECT ...)
-- Logic phân quyền giữ nguyên 100%, chỉ giúp Postgres cache theo từng query.
-- ============================================================================

BEGIN;

ALTER POLICY "Super admin can update modules" ON "public"."app_modules"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Strict Tenant Boundary Audit Logs" ON "public"."audit_logs"
  USING (((company_id = get_user_company_id()) OR (((SELECT (SELECT auth.jwt())) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Users can delete bom_lines for their company" ON "public"."bom_lines"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can insert bom_lines for their company" ON "public"."bom_lines"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update bom_lines for their company" ON "public"."bom_lines"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view bom_lines for their company" ON "public"."bom_lines"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can delete boms for their company" ON "public"."boms"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can insert boms for their company" ON "public"."boms"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update boms for their company" ON "public"."boms"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view boms for their company" ON "public"."boms"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Strict Tenant Boundary" ON "public"."branches"
  USING (((company_id = get_user_company_id()) OR (((SELECT (SELECT auth.jwt())) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Category Isolation Select" ON "public"."categories"
  USING (((company_id IS NULL) OR (company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid())))))));

ALTER POLICY "Category Strict Delete" ON "public"."categories"
  USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid()))))) AND ((( SELECT user_profiles.account_level
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid())))) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid())))))))));

ALTER POLICY "Category Strict Insert" ON "public"."categories"
  WITH CHECK (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid()))))) AND ((( SELECT user_profiles.account_level
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid())))) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid())))))))));

ALTER POLICY "Category Strict Update" ON "public"."categories"
  USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid()))))) AND ((( SELECT user_profiles.account_level
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid())))) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid())))))))))
  WITH CHECK (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid()))))) AND ((( SELECT user_profiles.account_level
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid())))) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid())))))))));

ALTER POLICY "Strict Tenant Boundary" ON "public"."categories"
  USING (((company_id = get_user_company_id()) OR (((SELECT (SELECT auth.jwt())) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Superuser Bypass Policy" ON "public"."categories"
  USING ((((SELECT (SELECT auth.jwt())) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Tenant Permissive Policy" ON "public"."categories"
  USING (((SELECT (SELECT auth.role())) = 'authenticated'::text));

ALTER POLICY "Authenticated users can read companies" ON "public"."companies"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Public read companies" ON "public"."companies"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Strict Tenant Boundary" ON "public"."companies"
  USING (((id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text)));

ALTER POLICY "Superadmins can manage companies" ON "public"."companies"
  USING (((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (SELECT auth.uid())) AND (user_profiles.account_level = 1))))));

ALTER POLICY "Superuser Bypass Policy" ON "public"."companies"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "settings_insert" ON "public"."company_settings"
  WITH CHECK (((SELECT (SELECT auth.uid())) IN ( SELECT user_profiles.id
   FROM user_profiles)));

ALTER POLICY "settings_manage" ON "public"."company_settings"
  USING ((((SELECT (SELECT auth.jwt())) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "settings_select" ON "public"."company_settings"
  USING (((id = get_my_company_id()) OR (((SELECT (SELECT auth.jwt())) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text)));

ALTER POLICY "Super Admin can delete subscriptions" ON "public"."company_subscriptions"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Super Admin can manage subscriptions" ON "public"."company_subscriptions"
  WITH CHECK ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Super Admin can update subscriptions" ON "public"."company_subscriptions"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Users can read own company subscriptions" ON "public"."company_subscriptions"
  USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text)));

ALTER POLICY "Enable delete access for users in same company" ON "public"."construction_members"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable insert access for users in same company" ON "public"."construction_members"
  WITH CHECK ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable read access for users in same company" ON "public"."construction_members"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable update access for users in same company" ON "public"."construction_members"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable delete access for users in same company" ON "public"."construction_phases"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable insert access for users in same company" ON "public"."construction_phases"
  WITH CHECK ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable read access for users in same company" ON "public"."construction_phases"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable update access for users in same company" ON "public"."construction_phases"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable delete access for users in same company" ON "public"."construction_projects"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable insert access for users in same company" ON "public"."construction_projects"
  WITH CHECK ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable read access for users in same company" ON "public"."construction_projects"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable update access for users in same company" ON "public"."construction_projects"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable delete access for users in same company" ON "public"."construction_tasks"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable insert access for users in same company" ON "public"."construction_tasks"
  WITH CHECK ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable read access for users in same company" ON "public"."construction_tasks"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable update access for users in same company" ON "public"."construction_tasks"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable delete access for users in same company" ON "public"."construction_teams"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable insert access for users in same company" ON "public"."construction_teams"
  WITH CHECK ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable read access for users in same company" ON "public"."construction_teams"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable update access for users in same company" ON "public"."construction_teams"
  USING ((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Strict Tenant Boundary" ON "public"."customers"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Superuser Bypass Policy" ON "public"."customers"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Tenant Permissive Policy" ON "public"."customers"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Users can create delivery journal" ON "public"."delivery_journal"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can delete delivery journal" ON "public"."delivery_journal"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update delivery journal" ON "public"."delivery_journal"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view delivery journal in their company" ON "public"."delivery_journal"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can delete delivery_settings" ON "public"."delivery_settings"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can insert delivery_settings" ON "public"."delivery_settings"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update delivery_settings" ON "public"."delivery_settings"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view delivery_settings in their company" ON "public"."delivery_settings"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can create shifts" ON "public"."delivery_shifts"
  WITH CHECK ((company_id IN ( SELECT delivery_shifts.company_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can delete shifts" ON "public"."delivery_shifts"
  USING ((company_id IN ( SELECT delivery_shifts.company_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update shifts" ON "public"."delivery_shifts"
  USING ((company_id IN ( SELECT delivery_shifts.company_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view shifts in their company" ON "public"."delivery_shifts"
  USING ((company_id IN ( SELECT delivery_shifts.company_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can create sub_shifts" ON "public"."delivery_sub_shifts"
  WITH CHECK ((company_id IN ( SELECT delivery_sub_shifts.company_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can delete sub_shifts" ON "public"."delivery_sub_shifts"
  USING ((company_id IN ( SELECT delivery_sub_shifts.company_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update sub_shifts" ON "public"."delivery_sub_shifts"
  USING ((company_id IN ( SELECT delivery_sub_shifts.company_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view sub_shifts in their company" ON "public"."delivery_sub_shifts"
  USING ((company_id IN ( SELECT delivery_sub_shifts.company_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can create handover records" ON "public"."handover_records"
  WITH CHECK ((company_id IN ( SELECT handover_records.company_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can delete handover records" ON "public"."handover_records"
  USING ((company_id IN ( SELECT handover_records.company_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update handover records" ON "public"."handover_records"
  USING ((company_id IN ( SELECT handover_records.company_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view handover records in their company" ON "public"."handover_records"
  USING ((company_id IN ( SELECT handover_records.company_id
   FROM profiles
  WHERE (profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable delete access for authenticated users" ON "public"."inbound_order_items"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable insert access for authenticated users" ON "public"."inbound_order_items"
  WITH CHECK (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable update access for authenticated users" ON "public"."inbound_order_items"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Strict Tenant Boundary Inbound Items" ON "public"."inbound_order_items"
  USING (((company_id = get_user_company_id()) OR (((SELECT (SELECT auth.jwt())) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Enable delete access for authenticated users" ON "public"."inbound_orders"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable insert access for authenticated users" ON "public"."inbound_orders"
  WITH CHECK (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable update access for authenticated users" ON "public"."inbound_orders"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Strict Tenant Boundary" ON "public"."inbound_orders"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Superuser Bypass Policy" ON "public"."inbound_orders"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Tenant Permissive Policy" ON "public"."inbound_orders"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable all for authenticated users" ON "public"."internal_product_code_rules"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Strict Tenant Boundary" ON "public"."inventory_check_items"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Strict Tenant Boundary" ON "public"."inventory_checks"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Strict Tenant Boundary" ON "public"."locations"
  USING (((company_id = get_user_company_id()) OR (((SELECT (SELECT auth.jwt())) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Strict Tenant Boundary Lot Items" ON "public"."lot_items"
  USING (((company_id = get_user_company_id()) OR (((SELECT (SELECT auth.jwt())) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Strict Tenant Boundary Lot Tags" ON "public"."lot_tags"
  USING ((((SELECT auth.role()) = 'anon'::text) OR (lot_id IN ( SELECT lots.id
   FROM lots)) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text)));

ALTER POLICY "Strict Tenant Boundary" ON "public"."lots"
  USING ((((SELECT auth.role()) = 'anon'::text) OR (company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Users can delete manufacturing_orders for their company" ON "public"."manufacturing_orders"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can insert manufacturing_orders for their company" ON "public"."manufacturing_orders"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update manufacturing_orders for their company" ON "public"."manufacturing_orders"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view manufacturing_orders for their company" ON "public"."manufacturing_orders"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can delete material_requisition_lines for their company" ON "public"."material_requisition_lines"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can insert material_requisition_lines for their company" ON "public"."material_requisition_lines"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update material_requisition_lines for their company" ON "public"."material_requisition_lines"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view material_requisition_lines for their company" ON "public"."material_requisition_lines"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can delete material_requisitions for their company" ON "public"."material_requisitions"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can insert material_requisitions for their company" ON "public"."material_requisitions"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update material_requisitions for their company" ON "public"."material_requisitions"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view material_requisitions for their company" ON "public"."material_requisitions"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable delete for own notes" ON "public"."operational_notes"
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "Enable insert for authenticated users" ON "public"."operational_notes"
  WITH CHECK (((SELECT auth.uid()) = user_id));

ALTER POLICY "Enable update for own notes" ON "public"."operational_notes"
  USING (((SELECT auth.uid()) = user_id));

ALTER POLICY "Strict Tenant Boundary" ON "public"."operational_notes"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Superuser Bypass Policy" ON "public"."operational_notes"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Tenant Permissive Policy" ON "public"."operational_notes"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Authenticated users can delete" ON "public"."order_types"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Authenticated users can insert" ON "public"."order_types"
  WITH CHECK (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Authenticated users can update" ON "public"."order_types"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable delete access for authenticated users" ON "public"."outbound_order_items"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable insert access for authenticated users" ON "public"."outbound_order_items"
  WITH CHECK (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable update access for authenticated users" ON "public"."outbound_order_items"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Strict Tenant Boundary Outbound Items" ON "public"."outbound_order_items"
  USING (((company_id = get_user_company_id()) OR (((SELECT (SELECT auth.jwt())) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Enable delete access for authenticated users" ON "public"."outbound_orders"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable insert access for authenticated users" ON "public"."outbound_orders"
  WITH CHECK (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable update access for authenticated users" ON "public"."outbound_orders"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Strict Tenant Boundary" ON "public"."outbound_orders"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Superuser Bypass Policy" ON "public"."outbound_orders"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Tenant Permissive Policy" ON "public"."outbound_orders"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable write access for admins only" ON "public"."permissions"
  USING ((EXISTS ( SELECT 1
   FROM user_profiles
  WHERE ((user_profiles.id = (SELECT auth.uid())) AND (EXISTS ( SELECT 1
           FROM roles
          WHERE ((roles.id = user_profiles.role_id) AND ((roles.code)::text = 'ADMIN'::text))))))));

ALTER POLICY "Strict Tenant Boundary" ON "public"."permissions"
  USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))
 LIMIT 1)) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Users can create pick requests" ON "public"."pick_requests"
  WITH CHECK (((SELECT auth.uid()) = requested_by));

ALTER POLICY "Users can update pick requests in their system" ON "public"."pick_requests"
  USING (((SELECT auth.uid()) IN ( SELECT user_profiles.id
   FROM user_profiles
  WHERE ((pick_requests.system_code = pick_requests.system_code) AND (user_profiles.company_id = pick_requests.company_id)))));

ALTER POLICY "Users can view pick requests in their system" ON "public"."pick_requests"
  USING (((SELECT auth.uid()) IN ( SELECT user_profiles.id
   FROM user_profiles
  WHERE ((pick_requests.system_code = pick_requests.system_code) AND (user_profiles.company_id = pick_requests.company_id)))));

ALTER POLICY "Authenticated users can read platform_modules" ON "public"."platform_modules"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Super Admin can manage platform_modules" ON "public"."platform_modules"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Strict Tenant Boundary" ON "public"."positions"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Users can delete print jobs for their company" ON "public"."print_queue"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can insert print jobs for their company" ON "public"."print_queue"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update print jobs for their company" ON "public"."print_queue"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view print jobs for their company" ON "public"."print_queue"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can manage product category relations of their company" ON "public"."product_category_rel"
  USING (((company_id IS NULL) OR (company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))))))
  WITH CHECK (((company_id IS NULL) OR (company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))))));

ALTER POLICY "Users can view product category relations of their company and " ON "public"."product_category_rel"
  USING (((company_id IS NULL) OR (company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))))));

ALTER POLICY "Enable delete for authenticated users only" ON "public"."product_media"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable insert for authenticated users only" ON "public"."product_media"
  WITH CHECK (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable update for authenticated users only" ON "public"."product_media"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable delete access for authenticated users" ON "public"."product_units"
  USING (((SELECT (SELECT auth.role())) = 'authenticated'::text));

ALTER POLICY "Enable insert access for authenticated users" ON "public"."product_units"
  WITH CHECK (((SELECT (SELECT auth.role())) = 'authenticated'::text));

ALTER POLICY "Enable read access for authenticated users" ON "public"."product_units"
  USING (((SELECT (SELECT auth.role())) = 'authenticated'::text));

ALTER POLICY "Enable update access for authenticated users" ON "public"."product_units"
  USING (((SELECT (SELECT auth.role())) = 'authenticated'::text));

ALTER POLICY "Strict Tenant Boundary" ON "public"."product_units"
  USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT (SELECT auth.uid())))
 LIMIT 1)) OR (((SELECT (SELECT auth.jwt())) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Users can delete production_code_levels for their company" ON "public"."production_code_levels"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can insert production_code_levels for their company" ON "public"."production_code_levels"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update production_code_levels for their company" ON "public"."production_code_levels"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view production_code_levels for their company" ON "public"."production_code_levels"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Enable all access for authenticated users" ON "public"."production_loans"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Users can delete production_lots for their company" ON "public"."production_lots"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can insert production_lots for their company" ON "public"."production_lots"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update production_lots for their company" ON "public"."production_lots"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view production_lots for their company" ON "public"."production_lots"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can delete production_records for their company" ON "public"."production_records"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can insert production_records for their company" ON "public"."production_records"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update production_records for their company" ON "public"."production_records"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view production_records for their company" ON "public"."production_records"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can delete productions for their company" ON "public"."productions"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can insert productions for their company" ON "public"."productions"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update productions for their company" ON "public"."productions"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view productions for their company" ON "public"."productions"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Strict Tenant Boundary" ON "public"."products"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Superuser Bypass Policy" ON "public"."products"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Tenant Permissive Policy" ON "public"."products"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Users can insert their own profile." ON "public"."profiles"
  WITH CHECK (((SELECT (SELECT auth.uid())) = id));

ALTER POLICY "Users can update own profile." ON "public"."profiles"
  USING (((SELECT (SELECT auth.uid())) = id));

ALTER POLICY "Authenticated users can delete" ON "public"."qc_info"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Authenticated users can insert" ON "public"."qc_info"
  WITH CHECK (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Authenticated users can update" ON "public"."qc_info"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Strict Tenant Boundary" ON "public"."qc_info"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Superuser Bypass Policy" ON "public"."qc_info"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Tenant Permissive Policy" ON "public"."qc_info"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Strict Tenant Boundary" ON "public"."roles"
  USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))
 LIMIT 1)) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Users can delete shift_task_messages" ON "public"."shift_task_messages"
  USING (((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))) OR (company_id IS NULL)));

ALTER POLICY "Users can insert shift_task_messages" ON "public"."shift_task_messages"
  WITH CHECK (((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))) OR (company_id IS NULL)));

ALTER POLICY "Users can view shift_task_messages in their company" ON "public"."shift_task_messages"
  USING (((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))) OR (company_id IS NULL)));

ALTER POLICY "Users can delete shift_tasks" ON "public"."shift_tasks"
  USING (((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))) OR (company_id IS NULL)));

ALTER POLICY "Users can insert shift_tasks" ON "public"."shift_tasks"
  WITH CHECK (((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))) OR (company_id IS NULL)));

ALTER POLICY "Users can update shift_tasks" ON "public"."shift_tasks"
  USING (((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))) OR (company_id IS NULL)));

ALTER POLICY "Users can view shift_tasks in their company" ON "public"."shift_tasks"
  USING (((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))) OR (company_id IS NULL)));

ALTER POLICY "Enable all access for authenticated users" ON "public"."site_loans"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable all for users" ON "public"."site_loans"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Strict Tenant Boundary" ON "public"."suppliers"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Superuser Bypass Policy" ON "public"."suppliers"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Tenant Permissive Policy" ON "public"."suppliers"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Enable delete for admins" ON "public"."systems"
  USING ((( SELECT user_profiles.account_level
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))) = ANY (ARRAY[1, 2])));

ALTER POLICY "Enable insert for admins" ON "public"."systems"
  WITH CHECK ((( SELECT user_profiles.account_level
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))) = ANY (ARRAY[1, 2])));

ALTER POLICY "Enable update for admins" ON "public"."systems"
  USING ((( SELECT user_profiles.account_level
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))) = ANY (ARRAY[1, 2])))
  WITH CHECK ((( SELECT user_profiles.account_level
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))) = ANY (ARRAY[1, 2])));

ALTER POLICY "systems_manage" ON "public"."systems"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "systems_select" ON "public"."systems"
  USING (((company_id = get_my_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text)));

ALTER POLICY "Strict Tenant Boundary" ON "public"."units"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Superuser Bypass Policy" ON "public"."units"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Tenant Permissive Policy" ON "public"."units"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Unit Isolation Select" ON "public"."units"
  USING (((company_id IS NULL) OR (company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))))));

ALTER POLICY "Unit Strict Delete" ON "public"."units"
  USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))) AND ((( SELECT user_profiles.account_level
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))))))));

ALTER POLICY "Unit Strict Insert" ON "public"."units"
  WITH CHECK (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))) AND ((( SELECT user_profiles.account_level
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))))))));

ALTER POLICY "Unit Strict Update" ON "public"."units"
  USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))) AND ((( SELECT user_profiles.account_level
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))))))))
  WITH CHECK (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))) AND ((( SELECT user_profiles.account_level
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))) = ANY (ARRAY[1, 2])) OR ('inventory.manage'::text = ANY (ARRAY( SELECT unnest(user_profiles.permissions) AS unnest
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))))))));

ALTER POLICY "Allow admin delete users" ON "public"."user_profiles"
  USING (((( SELECT up.account_level
   FROM user_profiles up
  WHERE (up.id = (SELECT (SELECT auth.uid())))) = 1) OR ((( SELECT up.account_level
   FROM user_profiles up
  WHERE (up.id = (SELECT (SELECT auth.uid())))) = 2) AND (company_id = get_user_company_id()))));

ALTER POLICY "Allow update users" ON "public"."user_profiles"
  USING (((( SELECT user_profiles_1.account_level
   FROM user_profiles user_profiles_1
  WHERE (user_profiles_1.id = (SELECT auth.uid()))) = 1) OR ((( SELECT user_profiles_1.account_level
   FROM user_profiles user_profiles_1
  WHERE (user_profiles_1.id = (SELECT auth.uid()))) = 2) AND (company_id = ( SELECT user_profiles_1.company_id
   FROM user_profiles user_profiles_1
  WHERE (user_profiles_1.id = (SELECT auth.uid()))))) OR ((SELECT auth.uid()) = id)));

ALTER POLICY "Strict Tenant Boundary" ON "public"."user_profiles"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "authenticated_update_own" ON "public"."user_profiles"
  USING ((id = (SELECT auth.uid())));

ALTER POLICY "Strict Tenant Boundary" ON "public"."vehicles"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Superuser Bypass Policy" ON "public"."vehicles"
  USING ((((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text));

ALTER POLICY "Tenant Permissive Policy" ON "public"."vehicles"
  USING (((SELECT auth.role()) = 'authenticated'::text));

ALTER POLICY "Strict Tenant Boundary" ON "public"."warehouses"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Users can delete work areas for their company" ON "public"."work_areas"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can insert work areas for their company" ON "public"."work_areas"
  WITH CHECK ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can update work areas for their company" ON "public"."work_areas"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Users can view work areas for their company" ON "public"."work_areas"
  USING ((company_id IN ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid())))));

ALTER POLICY "Strict Tenant Boundary" ON "public"."zone_layouts"
  USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))
 LIMIT 1)) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Strict Tenant Boundary" ON "public"."zone_templates"
  USING (((company_id = ( SELECT user_profiles.company_id
   FROM user_profiles
  WHERE (user_profiles.id = (SELECT auth.uid()))
 LIMIT 1)) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

ALTER POLICY "Strict Tenant Boundary" ON "public"."zones"
  USING (((company_id = get_user_company_id()) OR (((SELECT auth.jwt()) ->> 'email'::text) = 'tungdibui2609@gmail.com'::text) OR (company_id IS NULL)));

COMMIT;
