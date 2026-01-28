-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL, -- slug/identifier
    tax_code TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Policies for companies
-- For now, all authenticated users can see company info (to know which company they belong to)
CREATE POLICY "Authenticated users can read companies" ON public.companies
FOR SELECT
USING (auth.role() = 'authenticated');

-- Only superadmins can manage companies (via SQL Editor for now)
-- Or we can add a specific bypass for the superuser email
CREATE POLICY "Superuser can manage companies" ON public.companies
FOR ALL
USING (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com');

-- Add a default company for existing data
INSERT INTO public.companies (name, code)
VALUES ('AnyWarehouse', 'anywarehouse')
ON CONFLICT (code) DO NOTHING;
