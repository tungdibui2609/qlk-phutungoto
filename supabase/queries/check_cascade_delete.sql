-- CHECK FOREIGN KEY CONSTRAINTS
-- We want to see if "ON DELETE CASCADE" is set for company_id

SELECT 
    conname AS constraint_name, 
    conrelid::regclass AS table_name, 
    confrelid::regclass AS foreign_table_name, 
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint 
WHERE confrelid = 'public.company_settings'::regclass
AND conrelid::regclass::text IN ('public.categories', 'public.units', 'public.master_tags');
