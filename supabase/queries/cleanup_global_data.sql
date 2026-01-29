-- =============================================================================
-- SAFE CLEANUP: GLOBAL GHOST DATA
-- =============================================================================

-- 1. DELETE ORPHANED USER DATA (Safe to delete)
-- Categories, Units, and Tags created by users but missing company_id

DELETE FROM public.categories WHERE company_id IS NULL;
DELETE FROM public.units WHERE company_id IS NULL;
DELETE FROM public.master_tags WHERE company_id IS NULL;

-- 2. PROTECTED DATA (DO NOT DELETE)
-- Roles and System Configs are usually system-wide defaults.
-- We KEEP them to avoid breaking the system.

-- Verification: Show what remains (should only be Roles and Configs)
SELECT '--- REMAINING GLOBAL DATA (PROTECTED) ---' as info;
SELECT table_name, count(*) as global_count 
FROM (
    SELECT 'roles' as table_name FROM public.roles WHERE company_id IS NULL
    UNION ALL
    SELECT 'system_configs' as table_name FROM public.system_configs WHERE company_id IS NULL
) as summary
GROUP BY table_name;
