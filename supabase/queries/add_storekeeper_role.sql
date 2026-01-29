-- =============================================================================
-- ADD STOREKEEPER ROLE (THỦ KHO)
-- =============================================================================

INSERT INTO public.roles (code, name, description, permissions)
SELECT 'STOREKEEPER', 'Thủ kho', 'Chịu trách nhiệm quản lý kho và hàng hóa', 
to_jsonb(ARRAY['warehouse.view', 'warehouse.manage', 'inventory.view', 'inventory.manage']::text[])
WHERE NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'STOREKEEPER');

-- Updates role name if it already exists but with a different name
UPDATE public.roles 
SET name = 'Thủ kho', 
    permissions = to_jsonb(ARRAY['warehouse.view', 'warehouse.manage', 'inventory.view', 'inventory.manage']::text[])
WHERE code = 'STOREKEEPER';
