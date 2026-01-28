-- FINAL: Use a permissive policy for authenticated users to ensure visibility
-- This avoids circular references and ensures the user list displays correctly.
DROP POLICY IF EXISTS "Admins and authorized users can view all profiles" ON "public"."user_profiles";

CREATE POLICY "Admins and authorized users can view all profiles" ON "public"."user_profiles"
FOR SELECT
USING (auth.role() = 'authenticated');

-- Ensure authenticated users can read roles for the join
DROP POLICY IF EXISTS "Authenticated users can read roles" ON "public"."roles";
CREATE POLICY "Authenticated users can read roles" ON "public"."roles"
FOR SELECT
USING (auth.role() = 'authenticated');
