-- Add system_code to construction_phases and construction_tasks
-- This denormalizes the data slightly but allows for easier filtering by System without joining up to Project

DO $$
BEGIN
    -- 1. Add system_code to construction_phases
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'construction_phases' AND column_name = 'system_code') THEN
        ALTER TABLE public.construction_phases ADD COLUMN system_code text;
        CREATE INDEX IF NOT EXISTS idx_construction_phases_system ON public.construction_phases(system_code);
    END IF;

    -- 2. Add system_code to construction_tasks
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'construction_tasks' AND column_name = 'system_code') THEN
        ALTER TABLE public.construction_tasks ADD COLUMN system_code text;
        CREATE INDEX IF NOT EXISTS idx_construction_tasks_system ON public.construction_tasks(system_code);
    END IF;

END $$;
