-- FORCE DELETE USER (SAFE MODE)
-- Removes the user directly without touching system role permissions.

BEGIN;

-- 1. Delete associated profile first (to avoid foreign key issues)
DELETE FROM public.user_profiles WHERE email = 'tungdibui2609@gmail.com';

-- 2. Delete the user from the authentication system
DELETE FROM auth.users WHERE email = 'tungdibui2609@gmail.com';

COMMIT;
