-- Add user_id to construction_members to link team members with system login accounts
ALTER TABLE public.construction_members 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_construction_members_user_id 
ON public.construction_members(user_id);
