-- Ensure company_settings is linked to companies via Foreign Key on ID
-- This enables ON DELETE CASCADE to work properly.

DO $$
BEGIN
    -- Check if FK exists on 'id' column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'company_settings_id_fkey' 
        AND table_name = 'company_settings'
    ) THEN
        -- Add FK constraint
        ALTER TABLE public.company_settings
        ADD CONSTRAINT company_settings_id_fkey
        FOREIGN KEY (id)
        REFERENCES public.companies(id)
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Added FK company_settings(id) -> companies(id) with CASCADE';
    END IF;
END $$;
