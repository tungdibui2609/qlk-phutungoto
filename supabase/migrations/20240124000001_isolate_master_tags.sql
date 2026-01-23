-- Add system_code to master_tags
-- First check if column exists to avoid errors (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_tags' AND column_name = 'system_code') THEN
        ALTER TABLE master_tags ADD COLUMN system_code TEXT NOT NULL DEFAULT 'common';
    END IF;
END $$;

-- Update Primary Key to be composite
DO $$
BEGIN
    -- Drop old PK constraint if it exists (name usually master_tags_pkey)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'master_tags_pkey') THEN
        ALTER TABLE master_tags DROP CONSTRAINT master_tags_pkey;
    END IF;
    
    -- Add new composite PK
    ALTER TABLE master_tags ADD PRIMARY KEY (name, system_code);
END $$;
