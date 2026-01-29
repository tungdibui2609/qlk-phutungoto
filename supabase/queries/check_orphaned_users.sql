-- Find orphaned users (Exist in Auth but not in User Profiles)
SELECT au.id, au.email, au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL;
