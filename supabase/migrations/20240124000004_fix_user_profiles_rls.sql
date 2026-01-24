-- Enable RLS
ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;

-- 1. user_profiles Policies

-- Allow users to view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON "public"."user_profiles";
CREATE POLICY "Users can view own profile" ON "public"."user_profiles"
FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON "public"."user_profiles";
CREATE POLICY "Users can update own profile" ON "public"."user_profiles"
FOR UPDATE
USING (auth.uid() = id);

-- Allow admins to view all profiles (optional but good practice)
-- Assuming 'roles' table has a code 'ADMIN' and we can check against it via a subquery or jwt claims
-- valid_role check in profiles table suggests 'admin' role text.
-- But user_profiles links to roles table.
-- Let's stick to safe "Own Profile" first to fix the immediate error.


-- 2. roles Policies

-- Allow authenticated users to read roles (needed for the join)
DROP POLICY IF EXISTS "Authenticated users can read roles" ON "public"."roles";
CREATE POLICY "Authenticated users can read roles" ON "public"."roles"
FOR SELECT
USING (auth.role() = 'authenticated');
