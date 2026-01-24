-- Enable RLS on system_configs
ALTER TABLE "public"."system_configs" ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid "policy already exists" errors
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."system_configs";
DROP POLICY IF EXISTS "Enable insert/update for authenticated users" ON "public"."system_configs";

-- Allow read access for everyone (or authenticated)
CREATE POLICY "Enable read access for all users" ON "public"."system_configs"
FOR SELECT USING (true);

-- Allow update/insert for authenticated users
CREATE POLICY "Enable insert/update for authenticated users" ON "public"."system_configs"
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
