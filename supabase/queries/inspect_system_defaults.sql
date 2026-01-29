-- =============================================================================
-- INSPECT GLOBAL DATA CONTENT
-- =============================================================================

SELECT '--- ROLES (System Defaults?) ---' as info;
SELECT id, name, code, company_id FROM public.roles WHERE company_id IS NULL;

SELECT '--- SYSTEM CONFIGS ---' as info;
SELECT * FROM public.system_configs WHERE company_id IS NULL;

SELECT '--- MASTER TAGS ---' as info;
SELECT * FROM public.master_tags WHERE company_id IS NULL;

-- Note: user_profiles are not tables, so we look at tables only.
