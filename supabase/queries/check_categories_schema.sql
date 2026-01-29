-- CHECK SCHEMA AND POLICIES FOR CATEGORIES
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'categories';

SELECT * FROM pg_policies WHERE tablename = 'categories';

-- CHECK FOR ORPHANED DATA
-- Check if there are categories with company_id that doesn't exist in company_settings
SELECT COUNT(*) as orphaned_categories_count
FROM categories c
LEFT JOIN company_settings cs ON c.company_id = cs.id
WHERE cs.id IS NULL AND c.company_id IS NOT NULL;
