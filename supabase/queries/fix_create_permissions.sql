-- =============================================================================
-- FIX UNAUTHORIZED DATA CREATION (STRICT RLS)
-- =============================================================================

-- Purpose: Prevent Level 3 users (Employees) from creating/editing data 
-- unless they explicitly have the 'inventory.manage' permission.

-- 1. CATEGORIES POLICIES
DROP POLICY IF EXISTS "Category Isolation Insert" ON public.categories;
DROP POLICY IF EXISTS "Category Isolation Update" ON public.categories;
DROP POLICY IF EXISTS "Category Isolation Delete" ON public.categories;

-- INSERT: Admin (Level 1,2) OR has 'inventory.manage' permission
CREATE POLICY "Category Strict Insert" 
ON public.categories FOR INSERT 
TO authenticated 
WITH CHECK (
    (
        -- 1. Check Company Match
        company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    )
    AND
    (
        -- 2. Check Permissions
        (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) IN (1, 2)
        OR
        'inventory.manage' = ANY (ARRAY(SELECT UNNEST(permissions) FROM public.user_profiles WHERE id = auth.uid()))
    )
);

-- UPDATE: Admin (Level 1,2) OR has 'inventory.manage' permission
CREATE POLICY "Category Strict Update" 
ON public.categories FOR UPDATE 
TO authenticated 
USING (
    (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))
    AND
    (
        (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) IN (1, 2)
        OR
        'inventory.manage' = ANY (ARRAY(SELECT UNNEST(permissions) FROM public.user_profiles WHERE id = auth.uid()))
    )
)
WITH CHECK (
    (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))
    AND
    (
        (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) IN (1, 2)
        OR
        'inventory.manage' = ANY (ARRAY(SELECT UNNEST(permissions) FROM public.user_profiles WHERE id = auth.uid()))
    )
);

-- DELETE: Admin (Level 1,2) OR has 'inventory.manage' permission
CREATE POLICY "Category Strict Delete" 
ON public.categories FOR DELETE 
TO authenticated 
USING (
    (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))
    AND
    (
        (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) IN (1, 2)
        OR
        'inventory.manage' = ANY (ARRAY(SELECT UNNEST(permissions) FROM public.user_profiles WHERE id = auth.uid()))
    )
);


-- 2. UNITS POLICIES
DROP POLICY IF EXISTS "Unit Isolation Insert" ON public.units;
DROP POLICY IF EXISTS "Unit Isolation Update" ON public.units;
DROP POLICY IF EXISTS "Unit Isolation Delete" ON public.units;

-- INSERT
CREATE POLICY "Unit Strict Insert" 
ON public.units FOR INSERT 
TO authenticated 
WITH CHECK (
    (
        company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
    )
    AND
    (
        (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) IN (1, 2)
        OR
        'inventory.manage' = ANY (ARRAY(SELECT UNNEST(permissions) FROM public.user_profiles WHERE id = auth.uid()))
    )
);

-- UPDATE
CREATE POLICY "Unit Strict Update" 
ON public.units FOR UPDATE 
TO authenticated 
USING (
    (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))
    AND
    (
        (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) IN (1, 2)
        OR
        'inventory.manage' = ANY (ARRAY(SELECT UNNEST(permissions) FROM public.user_profiles WHERE id = auth.uid()))
    )
)
WITH CHECK (
    (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))
    AND
    (
        (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) IN (1, 2)
        OR
        'inventory.manage' = ANY (ARRAY(SELECT UNNEST(permissions) FROM public.user_profiles WHERE id = auth.uid()))
    )
);

-- DELETE
CREATE POLICY "Unit Strict Delete" 
ON public.units FOR DELETE 
TO authenticated 
USING (
    (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))
    AND
    (
        (SELECT account_level FROM public.user_profiles WHERE id = auth.uid()) IN (1, 2)
        OR
        'inventory.manage' = ANY (ARRAY(SELECT UNNEST(permissions) FROM public.user_profiles WHERE id = auth.uid()))
    )
);
