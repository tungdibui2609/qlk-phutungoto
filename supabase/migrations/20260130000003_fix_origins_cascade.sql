-- Add company_id to origins and enable cascade delete

DO $$
DECLARE
    default_company_id UUID;
BEGIN
    -- 1. Add company_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'origins' AND column_name = 'company_id') THEN
        ALTER TABLE public.origins ADD COLUMN company_id UUID;
    END IF;

    -- 2. Link existing records to a default company
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;
    
    IF default_company_id IS NOT NULL THEN
        UPDATE public.origins SET company_id = default_company_id WHERE company_id IS NULL;
    END IF;

    -- 3. Update the constraint to include ON DELETE CASCADE
    ALTER TABLE public.origins DROP CONSTRAINT IF EXISTS fk_origins_company;

    -- Add the FK with CASCADE
    ALTER TABLE public.origins
        ADD CONSTRAINT fk_origins_company
        FOREIGN KEY (company_id)
        REFERENCES public.companies(id)
        ON DELETE CASCADE;
        
END $$;
