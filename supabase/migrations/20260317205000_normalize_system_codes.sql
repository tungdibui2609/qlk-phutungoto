-- Normalize system identifiers: FROZEN -> KHO_DONG_LANH
-- This aligns the database with the application's new default and consistent naming.

-- 1. Update branches
UPDATE public.branches 
SET system_type = 'KHO_DONG_LANH' 
WHERE system_type = 'FROZEN';

-- 2. Update user_profiles allowed_systems array
-- We replace 'FROZEN' with 'KHO_DONG_LANH' in the allowed_systems array
UPDATE public.user_profiles
SET allowed_systems = array_replace(allowed_systems, 'FROZEN', 'KHO_DONG_LANH')
WHERE 'FROZEN' = ANY(allowed_systems);

-- 3. Update any other tables that might have FROZEN as system_type/system_code
UPDATE public.categories SET system_type = 'KHO_DONG_LANH' WHERE system_type = 'FROZEN';
UPDATE public.products SET system_type = 'KHO_DONG_LANH' WHERE system_type = 'FROZEN';
UPDATE public.products SET system_code = 'KHO_DONG_LANH' WHERE system_code = 'FROZEN';
UPDATE public.inbound_orders SET system_type = 'KHO_DONG_LANH' WHERE system_type = 'FROZEN';
UPDATE public.inbound_orders SET system_code = 'KHO_DONG_LANH' WHERE system_code = 'FROZEN';
UPDATE public.outbound_orders SET system_type = 'KHO_DONG_LANH' WHERE system_type = 'FROZEN';
UPDATE public.outbound_orders SET system_code = 'KHO_DONG_LANH' WHERE system_code = 'FROZEN';
UPDATE public.customers SET system_type = 'KHO_DONG_LANH' WHERE system_type = 'FROZEN';
UPDATE public.customers SET system_code = 'KHO_DONG_LANH' WHERE system_code = 'FROZEN';
UPDATE public.suppliers SET system_type = 'KHO_DONG_LANH' WHERE system_type = 'FROZEN';
UPDATE public.suppliers SET system_code = 'KHO_DONG_LANH' WHERE system_code = 'FROZEN';
UPDATE public.lots SET system_code = 'KHO_DONG_LANH' WHERE system_code = 'FROZEN';
UPDATE public.positions SET system_type = 'KHO_DONG_LANH' WHERE system_type = 'FROZEN';
UPDATE public.zones SET system_type = 'KHO_DONG_LANH' WHERE system_type = 'FROZEN';
