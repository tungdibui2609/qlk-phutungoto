-- ============================================================================
-- GÓI 1: ZERO-RISK SECURITY & PERFORMANCE FIX (AN TOÀN TUYỆT ĐỐI 100%)
-- Mục đích:
--   1. Xóa 4 policy cũ dùng user_metadata trên public.positions (4 lỗi CRITICAL)
--      -> Không đổi hành vi vì positions đã có "Permissive Access" + "Strict Tenant Boundary".
--   2. Tối ưu cảnh báo vàng Auth RLS Initialization Plan trên:
--      branches, categories, company_settings, locations, product_units
--      -> Bọc auth.uid() / auth.role() / auth.jwt() vào (select ...), logic giữ nguyên 100%.
-- Có thể chạy ngay trong Supabase Studio Local -> SQL Editor mà không làm gián đoạn kho.
-- ============================================================================

BEGIN;

-- 1. Xóa 4 policy user_metadata thừa trên public.positions
DROP POLICY IF EXISTS "Users can delete their company positions" ON "public"."positions";
DROP POLICY IF EXISTS "Users can insert their company positions" ON "public"."positions";
DROP POLICY IF EXISTS "Users can update their company positions" ON "public"."positions";
DROP POLICY IF EXISTS "Users can view their company positions" ON "public"."positions";

-- 2. Tối ưu Auth RLS Initialization Plan: public.branches
ALTER POLICY "Strict Tenant Boundary" ON "public"."branches"
  USING (
    ("company_id" = "public"."get_user_company_id"())
    OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")
    OR ("company_id" IS NULL)
  );

-- 3. Tối ưu Auth RLS Initialization Plan: public.categories
ALTER POLICY "Category Isolation Select" ON "public"."categories"
  USING (
    ("company_id" IS NULL)
    OR ("company_id" = (SELECT "user_profiles"."company_id" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))))
  );

ALTER POLICY "Category Strict Delete" ON "public"."categories"
  USING (
    ("company_id" = (SELECT "user_profiles"."company_id" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))))
    AND (
      ((SELECT "user_profiles"."account_level" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))) = ANY (ARRAY[1, 2]))
      OR ('inventory.manage'::"text" = ANY (ARRAY(SELECT "unnest"("user_profiles"."permissions") FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"())))))
    )
  );

ALTER POLICY "Category Strict Insert" ON "public"."categories"
  WITH CHECK (
    ("company_id" = (SELECT "user_profiles"."company_id" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))))
    AND (
      ((SELECT "user_profiles"."account_level" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))) = ANY (ARRAY[1, 2]))
      OR ('inventory.manage'::"text" = ANY (ARRAY(SELECT "unnest"("user_profiles"."permissions") FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"())))))
    )
  );

ALTER POLICY "Category Strict Update" ON "public"."categories"
  USING (
    ("company_id" = (SELECT "user_profiles"."company_id" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))))
    AND (
      ((SELECT "user_profiles"."account_level" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))) = ANY (ARRAY[1, 2]))
      OR ('inventory.manage'::"text" = ANY (ARRAY(SELECT "unnest"("user_profiles"."permissions") FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"())))))
    )
  )
  WITH CHECK (
    ("company_id" = (SELECT "user_profiles"."company_id" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))))
    AND (
      ((SELECT "user_profiles"."account_level" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"()))) = ANY (ARRAY[1, 2]))
      OR ('inventory.manage'::"text" = ANY (ARRAY(SELECT "unnest"("user_profiles"."permissions") FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"())))))
    )
  );

ALTER POLICY "Strict Tenant Boundary" ON "public"."categories"
  USING (
    ("company_id" = "public"."get_user_company_id"())
    OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")
    OR ("company_id" IS NULL)
  );

ALTER POLICY "Superuser Bypass Policy" ON "public"."categories"
  USING ((((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text"));

ALTER POLICY "Tenant Permissive Policy" ON "public"."categories"
  USING (((SELECT "auth"."role"()) = 'authenticated'::"text"));

-- 4. Tối ưu Auth RLS Initialization Plan: public.company_settings
ALTER POLICY "settings_insert" ON "public"."company_settings"
  WITH CHECK (((SELECT "auth"."uid"()) IN (SELECT "user_profiles"."id" FROM "public"."user_profiles")));

ALTER POLICY "settings_manage" ON "public"."company_settings"
  USING ((((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text"));

ALTER POLICY "settings_select" ON "public"."company_settings"
  USING (
    ("id" = "public"."get_my_company_id"())
    OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")
  );

-- 5. Tối ưu Auth RLS Initialization Plan: public.locations
ALTER POLICY "Strict Tenant Boundary" ON "public"."locations"
  USING (
    ("company_id" = "public"."get_user_company_id"())
    OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")
    OR ("company_id" IS NULL)
  );

-- 6. Tối ưu Auth RLS Initialization Plan: public.product_units
ALTER POLICY "Enable delete access for authenticated users" ON "public"."product_units"
  USING (((SELECT "auth"."role"()) = 'authenticated'::"text"));

ALTER POLICY "Enable insert access for authenticated users" ON "public"."product_units"
  WITH CHECK (((SELECT "auth"."role"()) = 'authenticated'::"text"));

ALTER POLICY "Enable read access for authenticated users" ON "public"."product_units"
  USING (((SELECT "auth"."role"()) = 'authenticated'::"text"));

ALTER POLICY "Enable update access for authenticated users" ON "public"."product_units"
  USING (((SELECT "auth"."role"()) = 'authenticated'::"text"));

ALTER POLICY "Strict Tenant Boundary" ON "public"."product_units"
  USING (
    ("company_id" = (SELECT "user_profiles"."company_id" FROM "public"."user_profiles" WHERE ("user_profiles"."id" = (SELECT "auth"."uid"())) LIMIT 1))
    OR (((SELECT "auth"."jwt"()) ->> 'email'::"text") = 'tungdibui2609@gmail.com'::"text")
    OR ("company_id" IS NULL)
  );

COMMIT;
