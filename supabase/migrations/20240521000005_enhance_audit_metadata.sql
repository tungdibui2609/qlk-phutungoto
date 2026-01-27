
-- Add metadata for Audit Scope and Participants
ALTER TABLE public.inventory_checks
ADD COLUMN IF NOT EXISTS scope text CHECK (scope IN ('ALL', 'PARTIAL')) DEFAULT 'ALL',
ADD COLUMN IF NOT EXISTS participants jsonb DEFAULT '[]'::jsonb;
