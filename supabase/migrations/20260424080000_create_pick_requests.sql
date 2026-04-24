-- Create pick_requests table
CREATE TABLE IF NOT EXISTS public.pick_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id UUID NOT NULL REFERENCES public.positions(id),
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    system_code TEXT NOT NULL,
    company_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending', -- Pending, In Progress, Completed, Cancelled
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.pick_requests ENABLE ROW LEVEL SECURITY;

-- Allow users to see requests in their system/company
CREATE POLICY "Users can view pick requests in their system"
    ON public.pick_requests
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.user_profiles 
            WHERE system_code = pick_requests.system_code 
            AND company_id = pick_requests.company_id
        )
    );

-- Allow mobile users to create requests
CREATE POLICY "Users can create pick requests"
    ON public.pick_requests
    FOR INSERT
    WITH CHECK (auth.uid() = requested_by);

-- Allow staff to update status
CREATE POLICY "Users can update pick requests in their system"
    ON public.pick_requests
    FOR UPDATE
    USING (
        auth.uid() IN (
            SELECT id FROM public.user_profiles 
            WHERE system_code = pick_requests.system_code 
            AND company_id = pick_requests.company_id
        )
    );
