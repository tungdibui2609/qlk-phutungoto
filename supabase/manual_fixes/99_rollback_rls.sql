-- ============================================================================
-- SCRIPT HOÀN TÁC KHẨN CẤP (ROLLBACK) CHO GÓI 2
-- Chạy script này nếu sau khi chạy 02_enable_rls_safe.sql thấy bất kỳ lỗi nào
-- khi nhân viên sử dụng app. Hệ thống sẽ quay về trạng thái trước đó trong 2 giây.
-- ============================================================================

BEGIN;

-- 1. Tắt lại RLS cho 12 bảng
ALTER TABLE "public"."audit_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."inbound_order_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."lot_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."lot_tags" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."outbound_order_items" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."permissions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_profiles" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."zone_positions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."product_vehicle_compatibility" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."production_places" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."production_inputs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."material_zones" DISABLE ROW LEVEL SECURITY;

-- 2. Trả 2 View thống kê về chế độ mặc định
ALTER VIEW "public"."production_allocation_statistics" SET (security_invoker = false);
ALTER VIEW "public"."production_item_statistics" SET (security_invoker = false);

-- 3. Khôi phục lại policy SELECT mở như cũ nếu cần
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."inbound_order_items";
CREATE POLICY "Enable read access for all users" ON "public"."inbound_order_items" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON "public"."outbound_order_items";
CREATE POLICY "Enable read access for all users" ON "public"."outbound_order_items" FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON "public"."permissions" FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all for authenticated zone_positions" ON "public"."zone_positions";
CREATE POLICY "Allow all for zone_positions" ON "public"."zone_positions" USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for authenticated lot_tags" ON "public"."lot_tags";
CREATE POLICY "Enable all access for lot_tags" ON "public"."lot_tags" USING (true) WITH CHECK (true);

COMMIT;
