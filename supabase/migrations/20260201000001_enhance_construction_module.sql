-- Create construction_projects table
CREATE TABLE IF NOT EXISTS public.construction_projects (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    system_code text NOT NULL, -- Logical link to systems.code
    code text,
    name text NOT NULL,
    description text,
    status text DEFAULT 'planning', -- planning, in_progress, completed, paused, cancelled
    start_date date,
    end_date date,
    manager_id uuid REFERENCES public.user_profiles(id),
    budget numeric,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES public.user_profiles(id),
    updated_at timestamptz DEFAULT now()
);

-- Create construction_phases table
CREATE TABLE IF NOT EXISTS public.construction_phases (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.construction_projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    status text DEFAULT 'pending',
    start_date date,
    end_date date,
    order_index integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES public.user_profiles(id),
    updated_at timestamptz DEFAULT now()
);

-- Create construction_tasks table
CREATE TABLE IF NOT EXISTS public.construction_tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.construction_projects(id) ON DELETE CASCADE,
    phase_id uuid REFERENCES public.construction_phases(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    assigned_to uuid REFERENCES public.construction_members(id), -- Assign to a team member
    status text DEFAULT 'pending', -- pending, doing, done, verified
    priority text DEFAULT 'medium', -- low, medium, high, urgent
    start_date date,
    due_date date,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES public.user_profiles(id),
    updated_at timestamptz DEFAULT now()
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS idx_construction_projects_company ON public.construction_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_construction_projects_system ON public.construction_projects(system_code);
CREATE INDEX IF NOT EXISTS idx_construction_phases_project ON public.construction_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_construction_tasks_project ON public.construction_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_construction_tasks_phase ON public.construction_tasks(phase_id);
CREATE INDEX IF NOT EXISTS idx_construction_tasks_assigned ON public.construction_tasks(assigned_to);

-- Enable RLS
ALTER TABLE public.construction_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_tasks ENABLE ROW LEVEL SECURITY;

-- Helper macro for RLS policies
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['construction_projects', 'construction_phases', 'construction_tasks']) LOOP
        -- Read
        EXECUTE format('DROP POLICY IF EXISTS "Enable read access for users in same company" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Enable read access for users in same company" ON public.%I FOR SELECT USING (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))', t);
        
        -- Insert
        EXECUTE format('DROP POLICY IF EXISTS "Enable insert access for users in same company" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Enable insert access for users in same company" ON public.%I FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))', t);

        -- Update
        EXECUTE format('DROP POLICY IF EXISTS "Enable update access for users in same company" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Enable update access for users in same company" ON public.%I FOR UPDATE USING (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))', t);

        -- Delete
        EXECUTE format('DROP POLICY IF EXISTS "Enable delete access for users in same company" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Enable delete access for users in same company" ON public.%I FOR DELETE USING (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))', t);
    END LOOP;
END $$;
