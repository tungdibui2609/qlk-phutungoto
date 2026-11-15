-- ============================================================================
-- GÓI 2: BẬT RLS AN TOÀN + CHẶN NGƯỜI CHƯA ĐĂNG NHẬP (ANON)
-- Đã xử lý đầy đủ 4 điểm rủi ro thực tế từ DB và code src/:
--   1. Tự động điền company_id mặc định khi insert lot_items, inbound_order_items,
--      outbound_order_items, audit_logs (vì code frontend không truyền company_id).
--   2. Bổ sung "OR company_id IS NULL" vào Strict Tenant Boundary của 4 bảng trên
--      (vì 89%-100% dữ liệu lịch sử đang có company_id IS NULL -> tránh mất dữ liệu
--      với các tài khoản nhân viên như tungnguyen@chanhthu.com / ctg.*).
--   3. Tạo PERMISSIVE policy cho authenticated TRƯỚC khi bật RLS cho lot_items
--      và 4 bảng chưa có policy (material_zones, product_vehicle_compatibility,
--      production_places, production_inputs).
--   4. Thêm policy DELETE cho admin trên user_profiles & đặt security_invoker = true
--      cho 2 view thống kê sản xuất.
-- Nếu có bất kỳ trục trặc nào -> chạy ngay file 99_rollback_rls.sql để hoàn tác!
-- ============================================================================

BEGIN;

-- 1. Tự động điền company_id khi frontend insert không truyền company_id
ALTER TABLE "public"."lot_items"
  ALTER COLUMN "company_id" SET DEFAULT "public"."get_user_company_id"();

ALTER TABLE "public"."inbound_order_items"
  ALTER COLUMN "company_id" SET DEFAULT "public"."get_user_company_id"();

ALTER TABLE "public"."outbound_order_items"
  ALTER COLUMN "company_id" SET DEFAULT "public"."get_user_company_id"();

ALTER TABLE "public"."audit_logs"
  ALTER COLUMN "company_id" SET DEFAULT "public"."get_user_company_id"();

-- 2. Cho phép đọc/ghi dữ liệu lịch sử có company_id IS NULL (đồng bộ với positions, branches...)
ALTER POLICY "Strict Tenant Boundary Lot Items" ON "public"."lot_items"
  USING (
    ("company_id" = "public"."get_user_company_id"())
    OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")
    OR ("company_id" IS NULL)
  );

ALTER POLICY "Strict Tenant Boundary Inbound Items" ON "public"."inbound_order_items"
  USING (
    ("company_id" = "public"."get_user_company_id"())
    OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")
    OR ("company_id" IS NULL)
  );

ALTER POLICY "Strict Tenant Boundary Outbound Items" ON "public"."outbound_order_items"
  USING (
    ("company_id" = "public"."get_user_company_id"())
    OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")
    OR ("company_id" IS NULL)
  );

ALTER POLICY "Strict Tenant Boundary Audit Logs" ON "public"."audit_logs"
  USING (
    ("company_id" = "public"."get_user_company_id"())
    OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")
    OR ("company_id" IS NULL)
  );

-- 3. Bổ sung PERMISSIVE policy cho authenticated TRƯỚC KHI bật RLS
-- 3.1. lot_items (hiện chỉ có RESTRICTIVE, thiếu PERMISSIVE -> cực kỳ quan trọng)
DROP POLICY IF EXISTS "Authenticated users full access on lot_items" ON "public"."lot_items";
CREATE POLICY "Authenticated users full access on lot_items"
  ON "public"."lot_items"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

-- 3.2. 4 bảng chưa có bất kỳ policy nào
DROP POLICY IF EXISTS "Authenticated users full access on material_zones" ON "public"."material_zones";
CREATE POLICY "Authenticated users full access on material_zones"
  ON "public"."material_zones"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access on product_vehicle_compatibility" ON "public"."product_vehicle_compatibility";
CREATE POLICY "Authenticated users full access on product_vehicle_compatibility"
  ON "public"."product_vehicle_compatibility"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access on production_places" ON "public"."production_places";
CREATE POLICY "Authenticated users full access on production_places"
  ON "public"."production_places"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users full access on production_inputs" ON "public"."production_inputs";
CREATE POLICY "Authenticated users full access on production_inputs"
  ON "public"."production_inputs"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

-- 3.3. Chặn anon đọc/ghi ở các bảng đang dùng USING (true) không giới hạn TO authenticated
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."inbound_order_items";
CREATE POLICY "Enable read access for authenticated users"
  ON "public"."inbound_order_items"
  FOR SELECT
  TO "authenticated"
  USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."outbound_order_items";
CREATE POLICY "Enable read access for authenticated users"
  ON "public"."outbound_order_items"
  FOR SELECT
  TO "authenticated"
  USING (true);

DROP POLICY IF EXISTS "Allow all for positions" ON "public"."positions";

DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."permissions";

DROP POLICY IF EXISTS "Allow all for zone_positions" ON "public"."zone_positions";
CREATE POLICY "Allow all for authenticated zone_positions"
  ON "public"."zone_positions"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for lot_tags" ON "public"."lot_tags";
DROP POLICY IF EXISTS "allow_select_on_lot_tags" ON "public"."lot_tags";
CREATE POLICY "Enable all access for authenticated lot_tags"
  ON "public"."lot_tags"
  FOR ALL
  TO "authenticated"
  USING (true)
  WITH CHECK (true);

-- 3.4. Bổ sung quyền DELETE cho admin cấp 1-2 trên user_profiles (tránh lỗi nút xóa ở trang /users)
DROP POLICY IF EXISTS "Allow admin delete users" ON "public"."user_profiles";
CREATE POLICY "Allow admin delete users"
  ON "public"."user_profiles"
  FOR DELETE
  TO "authenticated"
  USING (
    ((SELECT "up"."account_level" FROM "public"."user_profiles" "up" WHERE ("up"."id" = (SELECT "auth"."uid"()))) = 1)
    OR (
      ((SELECT "up"."account_level" FROM "public"."user_profiles" "up" WHERE ("up"."id" = (SELECT "auth"."uid"()))) = 2)
      AND ("company_id" = "public"."get_user_company_id"())
    )
  );

-- 4. Bật RLS cho toàn bộ 12 bảng đang bị cảnh báo đỏ
ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."inbound_order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."lot_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."lot_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."outbound_order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."zone_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."product_vehicle_compatibility" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."production_places" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."production_inputs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."material_zones" ENABLE ROW LEVEL SECURITY;

-- 5. Chuyển 2 View thống kê sản xuất sang security_invoker = true
ALTER VIEW "public"."production_allocation_statistics" SET (security_invoker = true);
ALTER VIEW "public"."production_item_statistics" SET (security_invoker = true);

COMMIT;
