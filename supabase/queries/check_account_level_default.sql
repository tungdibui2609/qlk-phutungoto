SELECT column_name, column_default, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles' AND column_name = 'account_level';
