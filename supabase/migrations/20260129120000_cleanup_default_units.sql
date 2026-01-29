-- Clean up unclassified units that are causing duplicates
-- These are likely leftover seed data with NULL system_code
DELETE FROM public.units 
WHERE system_code IS NULL 
AND name IN ('Bộ', 'Cái', 'Chiếc', 'Hộp', 'Lô', 'Gói', 'Bao', 'Thùng', 'Kg', 'Mét');
