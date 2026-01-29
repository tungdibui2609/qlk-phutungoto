-- =============================================================================
-- ENABLE CASCADE DELETE FOR AUTOMATIC CLEANUP
-- =============================================================================
-- This script modifies the Foreign Keys to ensure that when a Company is deleted,
-- all its related Categories, Units, and Tags are automatically deleted too.

-- 1. CATEGORIES
ALTER TABLE public.categories
DROP CONSTRAINT IF EXISTS categories_company_id_fkey;

ALTER TABLE public.categories
ADD CONSTRAINT categories_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES public.company_settings(id)
ON DELETE CASCADE;

-- 2. UNITS
ALTER TABLE public.units
DROP CONSTRAINT IF EXISTS units_company_id_fkey;

ALTER TABLE public.units
ADD CONSTRAINT units_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES public.company_settings(id)
ON DELETE CASCADE;

-- 3. MASTER TAGS
ALTER TABLE public.master_tags
DROP CONSTRAINT IF EXISTS master_tags_company_id_fkey;

ALTER TABLE public.master_tags
ADD CONSTRAINT master_tags_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES public.company_settings(id)
ON DELETE CASCADE;

-- 4. PRODUCTS (Just in case, very important!)
-- If you delete a company, its products should definitely be gone.
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_company_id_fkey;

ALTER TABLE public.products
ADD CONSTRAINT products_company_id_fkey
FOREIGN KEY (company_id)
REFERENCES public.company_settings(id)
ON DELETE CASCADE;
