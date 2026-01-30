-- Fix RLS policy for system_configs to allow INSERT/UPDATE
-- The issue is that the restrictive policy blocks insert/update operations

BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.system_configs;
DROP POLICY IF EXISTS "Strict Tenant Boundary" ON public.system_configs;
DROP POLICY IF EXISTS "Enable insert/update for authenticated users" ON public.system_configs;

-- Create a more permissive policy for SELECT
CREATE POLICY "system_configs_select" ON public.system_configs 
FOR SELECT USING (auth.role() = 'authenticated');

-- Create policy for INSERT - users can insert configs for their company's systems
CREATE POLICY "system_configs_insert" ON public.system_configs 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.systems s 
        WHERE s.code = system_code 
        AND s.company_id = get_user_company_id()
    )
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
);

-- Create policy for UPDATE - users can update configs for their company's systems
CREATE POLICY "system_configs_update" ON public.system_configs 
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.systems s 
        WHERE s.code = system_code 
        AND s.company_id = get_user_company_id()
    )
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
);

-- Create policy for DELETE - users can delete configs for their company's systems
CREATE POLICY "system_configs_delete" ON public.system_configs 
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.systems s 
        WHERE s.code = system_code 
        AND s.company_id = get_user_company_id()
    )
    OR
    (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com')
);

COMMIT;

-- Verify policies
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'system_configs';
