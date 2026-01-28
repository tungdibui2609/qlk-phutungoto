-- Fix master_tags deletion by ensuring it belongs to a company

DO $$
DECLARE
    default_company_id UUID;
BEGIN
    -- Get default company
    SELECT id INTO default_company_id FROM public.companies WHERE code = 'anywarehouse' LIMIT 1;
    
    -- 1. Add company_id if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_tags' AND column_name = 'company_id') THEN
        ALTER TABLE public.master_tags ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;
        
        -- Backfill existing tags to default company if available, or just leave NULL if we accept global tags.
        -- User wants them deleted, so they probably expect them to be company specific.
        IF default_company_id IS NOT NULL THEN
            UPDATE public.master_tags SET company_id = default_company_id WHERE company_id IS NULL;
        END IF;
    END IF;

    -- 2. Update Primary Key to include company_id
    -- Current PK is (name, system_code)
    -- We want (name, system_code, company_id) to allow same tags in different companies
    
    -- Drop old PK
    -- Note: constraint name usually master_tags_pkey, but specifically it was set on (name, system_code) in previous migration
    -- Let's try to drop it by name 'master_tags_pkey' if it matches.
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'master_tags_pkey') THEN
        ALTER TABLE public.master_tags DROP CONSTRAINT master_tags_pkey;
    END IF;
    
    -- Re-add PK
    -- Note: If company_id is NULL for some reason (e.g. global tags), this PK might be weird.
    -- Assuming we want all tags to now be company specific.
    -- Force NOT NULL on company_id?
    -- For now, let's keep it nullable BUT if it's NULL, we can't really "delete by company".
    -- But since we used ON DELETE CASCADE on the FK, only rows WITH company_id will be deleted.
    -- Rows with NULL company_id will persist (which is correct for "Global Tags").
    
    -- However, to allow "Cafe" tag in Company A and "Cafe" tag in Company B, we need company_id in PK.
    -- If company_id is NULLable, standard SQL unique index allows multiple NULLs in strict sense but PK doesn't allow NULLs.
    -- So we should probably make it NOT NULL if we want it in PK.
    
    IF default_company_id IS NOT NULL THEN
        ALTER TABLE public.master_tags ALTER COLUMN company_id SET DEFAULT default_company_id;
        ALTER TABLE public.master_tags ALTER COLUMN company_id SET NOT NULL;
        
        ALTER TABLE public.master_tags ADD PRIMARY KEY (name, system_code, company_id);
    ELSE
        -- If no default company, we cannot enforce NOT NULL yet. 
        -- Just add index for performance?
        -- But for deletion, constraints are enough.
        RAISE NOTICE 'Skipping PK update for master_tags due to missing default company';
    END IF;

END $$;
