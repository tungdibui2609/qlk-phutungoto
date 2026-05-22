-- SQL Security Verification Script: Testing Data Isolation & RLS Performance
-- This script simulates different user roles (Tenant User vs. Super Admin) using Supabase Auth JWT emulation.
-- Execute this in the Supabase SQL Editor. It runs within a transaction and rolls back automatically, making it 100% safe.

BEGIN;

-- =========================================================================
-- 1. PREPARATION: Create Test Companies, Branches, and Profiles
-- =========================================================================
DO $$ BEGIN RAISE NOTICE '--- SETUP: Creating test tenants and data ---'; END $$;

-- Insert Test Company A & B
INSERT INTO public.companies (id, name, code, unlocked_modules)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Test Tenant Company A', 'TESTA', ARRAY['inbound_basic', 'outbound_basic', 'units']),
    ('22222222-2222-2222-2222-222222222222', 'Test Tenant Company B', 'TESTB', ARRAY['inbound_basic'])
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code;

-- Insert Company Settings for Company A & B (Required by products foreign key constraint)
INSERT INTO public.company_settings (id, name)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Test Tenant Company A Settings'),
    ('22222222-2222-2222-2222-222222222222', 'Test Tenant Company B Settings')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Insert Branches for Company A & B
INSERT INTO public.branches (id, company_id, code, name)
VALUES 
    ('11111111-b1b1-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'BRANCHA', 'Branch of Tenant A'),
    ('22222222-b2b2-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'BRANCHB', 'Branch of Tenant B')
ON CONFLICT (id) DO NOTHING;

-- Insert Products for Company A & B
INSERT INTO public.products (id, company_id, name, sku)
VALUES 
    ('11111111-f1f1-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Product of Tenant A', 'SKU-A'),
    ('22222222-f2f2-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Product of Tenant B', 'SKU-B')
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- TEST CASE 1: SIMULATE TENANT A USER (Strict Isolation Enforced)
-- =========================================================================
DO $$ BEGIN RAISE NOTICE '--- TEST CASE 1: Simulating Tenant A Staff ---'; END $$;

-- Set JWT Claim: Emulating User 'staff_a@test.com' belonging to Tenant A (11111111-...)
-- Also configuring get_user_company_id() cache claim 'app.company_id'
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', json_build_object(
    'sub', '11111111-a1a1-1111-1111-111111111111',
    'email', 'staff_a@test.com',
    'app_metadata', json_build_object('provider', 'email'),
    'user_metadata', json_build_object('company_id', '11111111-1111-1111-1111-111111111111')
)::text, true);

-- Perform RLS checks:
-- 1. Branches: Must only see Branch of Tenant A
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.branches;
    RAISE NOTICE 'Tenant A sees % branches (Expected: 1)', v_count;
    
    -- Check if Tenant A accidentally sees Tenant B's branch
    SELECT COUNT(*) INTO v_count FROM public.branches WHERE id = '22222222-b2b2-2222-2222-222222222222';
    IF v_count > 0 THEN
        RAISE EXCEPTION 'RLS FAILURE: Tenant A can see Tenant B branch!';
    ELSE
        RAISE NOTICE '✅ RLS PASS: Tenant A cannot see Tenant B branch.';
    END IF;
END $$;

-- 2. Products: Must only see Product of Tenant A
DO $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.products;
    RAISE NOTICE 'Tenant A sees % products (Expected: 1)', v_count;
    
    SELECT COUNT(*) INTO v_count FROM public.products WHERE id = '22222222-f2f2-2222-2222-222222222222';
    IF v_count > 0 THEN
        RAISE EXCEPTION 'RLS FAILURE: Tenant A can see Tenant B product!';
    ELSE
        RAISE NOTICE '✅ RLS PASS: Tenant A cannot see Tenant B product.';
    END IF;
END $$;

-- =========================================================================
-- TEST CASE 2: SIMULATE SUPER ADMIN BYPASS
-- =========================================================================
DO $$ BEGIN RAISE NOTICE '--- TEST CASE 2: Simulating Super Admin (tungdibui2609@gmail.com) ---'; END $$;

-- Set JWT Claim: Emulating Super Admin 'tungdibui2609@gmail.com'
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', json_build_object(
    'sub', '00000000-0000-0000-0000-000000000000',
    'email', 'tungdibui2609@gmail.com'
)::text, true);

-- Super Admin must see all branches and products
DO $$
DECLARE
    v_branches_count INT;
    v_products_count INT;
BEGIN
    SELECT COUNT(*) INTO v_branches_count FROM public.branches;
    SELECT COUNT(*) INTO v_products_count FROM public.products;
    
    RAISE NOTICE 'Super Admin sees % branches and % products (Expected: all setup data visible)', v_branches_count, v_products_count;
    
    IF v_branches_count >= 2 AND v_products_count >= 2 THEN
        RAISE NOTICE '✅ RLS PASS: Super Admin successfully bypassed RLS boundaries to manage all tenants.';
    ELSE
        RAISE EXCEPTION 'RLS FAILURE: Super Admin is restricted by RLS policies!';
    END IF;
END $$;

-- =========================================================================
-- 3. CLEANUP & ROLLBACK (Leaves Database Untouched)
-- =========================================================================
DO $$ BEGIN RAISE NOTICE '--- CLEANUP: Rolling back all test records ---'; END $$;
ROLLBACK;
DO $$ BEGIN RAISE NOTICE 'Transaction rolled back successfully. live database is completely clean!'; END $$;
