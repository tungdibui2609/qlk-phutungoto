-- Create construction_teams table
CREATE TABLE IF NOT EXISTS public.construction_teams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    code text,
    name text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES public.user_profiles(id),
    updated_at timestamptz DEFAULT now()
);

-- Create construction_members table (manual members, not system users)
CREATE TABLE IF NOT EXISTS public.construction_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    team_id uuid REFERENCES public.construction_teams(id) ON DELETE SET NULL,
    full_name text NOT NULL,
    phone text,
    role text, -- e.g., 'Worker', 'Leader', 'Driver'
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES public.user_profiles(id),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.construction_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for construction_teams
DROP POLICY IF EXISTS "Enable read access for users in same company" ON public.construction_teams;
CREATE POLICY "Enable read access for users in same company" ON public.construction_teams
    FOR SELECT
    USING (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Enable insert access for users in same company" ON public.construction_teams;
CREATE POLICY "Enable insert access for users in same company" ON public.construction_teams
    FOR INSERT
    WITH CHECK (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Enable update access for users in same company" ON public.construction_teams;
CREATE POLICY "Enable update access for users in same company" ON public.construction_teams
    FOR UPDATE
    USING (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Enable delete access for users in same company" ON public.construction_teams;
CREATE POLICY "Enable delete access for users in same company" ON public.construction_teams
    FOR DELETE
    USING (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

-- RLS Policies for construction_members
DROP POLICY IF EXISTS "Enable read access for users in same company" ON public.construction_members;
CREATE POLICY "Enable read access for users in same company" ON public.construction_members
    FOR SELECT
    USING (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Enable insert access for users in same company" ON public.construction_members;
CREATE POLICY "Enable insert access for users in same company" ON public.construction_members
    FOR INSERT
    WITH CHECK (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Enable update access for users in same company" ON public.construction_members;
CREATE POLICY "Enable update access for users in same company" ON public.construction_members
    FOR UPDATE
    USING (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Enable delete access for users in same company" ON public.construction_members;
CREATE POLICY "Enable delete access for users in same company" ON public.construction_members
    FOR DELETE
    USING (company_id = (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()));
