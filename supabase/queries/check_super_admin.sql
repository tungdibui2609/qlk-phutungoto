-- Check if super admin exists
SELECT id, email, created_at, last_sign_in_at 
FROM auth.users 
WHERE email = 'tungdibui2609@gmail.com';

SELECT id, email, full_name, role_id 
FROM public.user_profiles 
WHERE email = 'tungdibui2609@gmail.com';
