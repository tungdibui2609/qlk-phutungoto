-- Make systems table multi-tenant
-- 1. Explicitly Drop ALL referencing Foreign Keys first (Soft Link approach)
-- 2. Add company_id column
-- 3. Update Primary Key to ID (UUID)
-- 4. Enable RLS

BEGIN;

-- 1. DROP ALL Foreign Keys referencing public.systems
-- We do this dynamically to catch 'fk_branches_system_type', 'fk_products_system_type' etc.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.table_schema, tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.referential_constraints AS rc
          ON tc.constraint_name = rc.constraint_name
        WHERE rc.constraint_schema = 'public'
          AND rc.unique_constraint_name IN (
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'systems' AND constraint_type = 'PRIMARY KEY'
          )
    ) LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.table_schema, r.table_name, r.constraint_name);
        RAISE NOTICE 'Dropped FK constraint: %.%', r.table_name, r.constraint_name;
    END LOOP;
END $$;

-- 2. Add company_id
ALTER TABLE public.systems 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- 3. Handle Primary Key transformation
-- Add new UUID ID if not exists
ALTER TABLE public.systems ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Drop old PK on 'code' (now that FKs are gone, this is safe)
ALTER TABLE public.systems DROP CONSTRAINT IF EXISTS systems_pkey;
-- Drop any unique constraint on 'code' if exists
ALTER TABLE public.systems DROP CONSTRAINT IF EXISTS systems_code_key;

-- Set new PK
ALTER TABLE public.systems ADD CONSTRAINT systems_pkey PRIMARY KEY (id);

-- Code unique per company (allows 'FROZEN' in Company A and 'FROZEN' in Company B)
ALTER TABLE public.systems ADD CONSTRAINT systems_code_company_key UNIQUE (code, company_id);

-- 4. Enable RLS
ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflict
DROP POLICY IF EXISTS "Enable read/write for users based on company_id" ON public.systems;

CREATE POLICY "Enable read/write for users based on company_id" ON public.systems
FOR ALL
USING (
    company_id IS NULL -- Global templates (if we keep them)
    OR 
    company_id IN (
        SELECT company_id FROM public.user_profiles 
        WHERE id = auth.uid()
    )
)
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.user_profiles 
        WHERE id = auth.uid()
    )
);

COMMIT;
