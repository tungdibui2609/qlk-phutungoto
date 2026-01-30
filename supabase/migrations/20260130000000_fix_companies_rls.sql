-- Migration: Fix RLS policies for companies table to allow all Super Admins
-- Date: 2026-01-30

-- First, drop the existing restrictive policies if they exist (handling potential naming variations)
DROP POLICY IF EXISTS "Superuser can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Superuser can manage companies V2" ON public.companies;

-- Create a comprehensive policy for Super Admins (account_level = 1)
-- This allows them to INSERT, UPDATE, DELETE companies.
-- We keep a fallback for the hardcoded email just in case account_level logic fails or for bootstrapping.

CREATE POLICY "Superadmins can manage companies" ON public.companies
FOR ALL
USING (
  (auth.jwt() ->> 'email' = 'tungdibui2609@gmail.com') OR
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.account_level = 1
  )
);

-- Ensure "Authenticated users can read companies" still exists or is re-created if needed
-- (Assuming it exists from previous migrations, but good to be safe if we want to be thorough, 
--  however usually we just add/replace the management policy).
-- The existing read policy is: "Authenticated users can read companies" (See 20260128100000_create_companies.sql)
-- We do not touch that.
