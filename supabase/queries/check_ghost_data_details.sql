-- =============================================================================
-- DIAGNOSTIC: CHECK DATA LINKAGE (GHOST DATA INVESTIGATION)
-- =============================================================================

-- 1. Check ALL Companies
SELECT '--- ALL COMPANIES ---' as info;
SELECT id, code, name FROM public.company_settings;

-- 2. Check CURRENT USER'S Company
SELECT '--- YOUR PROFILE ---' as info;
SELECT id, email, full_name, company_id, account_level 
FROM public.user_profiles 
WHERE email = 'tungdibui2609@gmail.com' OR account_level = 2;

-- 3. Check CATEGORIES and their Owners
SELECT '--- CATEGORIES ANALYSIS ---' as info;
SELECT 
    c.id, 
    c.name, 
    c.system_type,
    c.company_id, 
    comp.name as company_name,
    CASE 
        WHEN c.company_id IS NULL THEN 'GLOBAL (Shared)'
        WHEN comp.id IS NOT NULL THEN 'VALID Link'
        ELSE 'ORPHAN (Ghost Data)' 
    END as status
FROM public.categories c
LEFT JOIN public.company_settings comp ON c.company_id = comp.id
ORDER BY c.name;
