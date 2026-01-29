SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' AND column_name = 'permissions';
