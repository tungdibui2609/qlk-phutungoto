-- Enable RLS on lots
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone for lots
DROP POLICY IF EXISTS "Enable read access for all users" ON lots;
CREATE POLICY "Enable read access for all users" ON lots
    FOR SELECT USING (true);

-- Allow write access to everyone for lots (users/anon for now)
DROP POLICY IF EXISTS "Enable insert for all users" ON lots;
CREATE POLICY "Enable insert for all users" ON lots
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for all users" ON lots;
CREATE POLICY "Enable update for all users" ON lots
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Enable delete for all users" ON lots;
CREATE POLICY "Enable delete for all users" ON lots
    FOR DELETE USING (true);

-- Ensure products and suppliers are readable
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON products
    FOR SELECT USING (true);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON suppliers
    FOR SELECT USING (true);

-- Not checking if they exist to avoid errors, just create provided they don't break if exists
-- (Supabase might error if policy exists, so best to Drop If Exists first)
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
CREATE POLICY "Enable read access for all users" ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable read access for all users" ON suppliers;
CREATE POLICY "Enable read access for all users" ON suppliers FOR SELECT USING (true);
