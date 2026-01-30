-- Add company_id to order_types and enable cascade delete

DO $$
DECLARE
    default_company_id UUID;
BEGIN
    -- 1. Add company_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_types' AND column_name = 'company_id') THEN
        ALTER TABLE public.order_types ADD COLUMN company_id UUID;
    END IF;

    -- 2. Link existing records to a default company (optional, but good for consistency if there is data)
    -- Try to find the default 'anywarehouse' company, or just one if exists
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;
    
    IF default_company_id IS NOT NULL THEN
        UPDATE public.order_types SET company_id = default_company_id WHERE company_id IS NULL;
    END IF;

    -- 3. Update the constraint to include ON DELETE CASCADE
    -- First drop existing constraint if specifically named (unlikely given it was missing, but good practice)
    -- Or just drop the check constraint we are about to add if it conflcits (but we adding FK)
    
    -- We assume no FK exists yet based on the issue description.
    -- However, let's safely drop if it coincidentally exists with the name we want to use.
    ALTER TABLE public.order_types DROP CONSTRAINT IF EXISTS fk_order_types_company;

    -- Add the FK with CASCADE
    ALTER TABLE public.order_types
        ADD CONSTRAINT fk_order_types_company
        FOREIGN KEY (company_id)
        REFERENCES public.companies(id)
        ON DELETE CASCADE;
        
END $$;
