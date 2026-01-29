-- Add username_prefix column to companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS username_prefix TEXT;

-- Add a constraint to ensure it's unique and follows format (optional, but good practice)
-- Ideally 3-6 chars, lowercase alphanumeric
ALTER TABLE public.companies
ADD CONSTRAINT username_prefix_check CHECK (username_prefix ~ '^[a-z0-9]{2,10}$');

ALTER TABLE public.companies
ADD CONSTRAINT username_prefix_unique UNIQUE (username_prefix);

-- Update default company
UPDATE public.companies
SET username_prefix = 'any'
WHERE code = 'anywarehouse';

-- If there are other companies without prefix, we might need to handle them?
-- For now we assume manual update or future admin UI
