-- Add is_system column to companies table
-- This marks system companies that should be hidden from the UI

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Mark the anywarehouse company as system
UPDATE public.companies SET is_system = true WHERE code = 'anywarehouse';

-- Add comment for documentation
COMMENT ON COLUMN public.companies.is_system IS 'If true, this is a system company (hidden from normal views)';
