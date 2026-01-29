-- =============================================================================
-- FIX DATA ISOLATION & CLEANUP ORPHANED DATA
-- =============================================================================

-- 1. CLEANUP ORPHANED DATA (Ghost Data)
-- Delete categories belonging to deleted companies
DELETE FROM public.categories 
WHERE company_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM public.company_settings WHERE id = categories.company_id);

-- Delete units belonging to deleted companies (if table exists)
DELETE FROM public.units 
WHERE company_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM public.company_settings WHERE id = units.company_id);

-- 2. FIX RLS FOR CATEGORIES
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.categories;
DROP POLICY IF EXISTS "Enable insert for users based on company" ON public.categories;
DROP POLICY IF EXISTS "Enable update for users based on company" ON public.categories;
DROP POLICY IF EXISTS "Enable delete for users based on company" ON public.categories;

-- Policy: VIEW (Read)
-- Users see global categories (company_id NULL) OR their own company's categories
CREATE POLICY "Category Isolation Select" 
ON public.categories FOR SELECT 
TO authenticated 
USING (
    company_id IS NULL OR 
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- Policy: INSERT
-- Users can only insert for their own company
CREATE POLICY "Category Isolation Insert" 
ON public.categories FOR INSERT 
TO authenticated 
WITH CHECK (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- Policy: UPDATE
-- Users can only update their own company's categories
CREATE POLICY "Category Isolation Update" 
ON public.categories FOR UPDATE 
TO authenticated 
USING (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
)
WITH CHECK (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- Policy: DELETE
-- Users can only delete their own company's categories
CREATE POLICY "Category Isolation Delete" 
ON public.categories FOR DELETE 
TO authenticated 
USING (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

GRANT ALL ON public.categories TO authenticated;

-- 3. FIX RLS FOR UNITS (Example for consistency)
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Unit Isolation Select" ON public.units;
DROP POLICY IF EXISTS "Unit Isolation Insert" ON public.units;
DROP POLICY IF EXISTS "Unit Isolation Update" ON public.units;
DROP POLICY IF EXISTS "Unit Isolation Delete" ON public.units;

CREATE POLICY "Unit Isolation Select" 
ON public.units FOR SELECT 
TO authenticated 
USING (
    company_id IS NULL OR 
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Unit Isolation Insert" 
ON public.units FOR INSERT 
TO authenticated 
WITH CHECK (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Unit Isolation Update" 
ON public.units FOR UPDATE 
TO authenticated 
USING (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

CREATE POLICY "Unit Isolation Delete" 
ON public.units FOR DELETE 
TO authenticated 
USING (
    company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

GRANT ALL ON public.units TO authenticated;
