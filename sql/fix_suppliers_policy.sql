-- Enable RLS (already enabled likely, but good to ensure)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Allow insert
DROP POLICY IF EXISTS "Enable insert for all users" ON suppliers;
CREATE POLICY "Enable insert for all users" ON suppliers
    FOR INSERT WITH CHECK (true);

-- Allow update
DROP POLICY IF EXISTS "Enable update for all users" ON suppliers;
CREATE POLICY "Enable update for all users" ON suppliers
    FOR UPDATE USING (true);

-- Allow delete
DROP POLICY IF EXISTS "Enable delete for all users" ON suppliers;
CREATE POLICY "Enable delete for all users" ON suppliers
    FOR DELETE USING (true);
