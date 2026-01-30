-- Add system_code to construction_teams and construction_members to support filtering by Warehouse Module
-- This ensures resources (Teams/Workers) are specific to a Warehouse System (e.g. Spare Parts vs Frozen)

DO $$
BEGIN
    -- 1. Add system_code to construction_teams
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'construction_teams' AND column_name = 'system_code') THEN
        ALTER TABLE public.construction_teams ADD COLUMN system_code text;
        CREATE INDEX IF NOT EXISTS idx_construction_teams_system ON public.construction_teams(system_code);
    END IF;

    -- 2. Add system_code to construction_members
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'construction_members' AND column_name = 'system_code') THEN
        ALTER TABLE public.construction_members ADD COLUMN system_code text;
        CREATE INDEX IF NOT EXISTS idx_construction_members_system ON public.construction_members(system_code);
    END IF;

END $$;
