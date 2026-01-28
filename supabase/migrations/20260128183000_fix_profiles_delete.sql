-- Fix profiles table (legacy/starter table) to ensure it deletes when auth.users are deleted

DO $$
BEGIN
    -- 1. Clean up orphaned profiles first (profiles that have no corresponding auth user)
    -- This handles the junk currently seen by the user
    DELETE FROM public.profiles 
    WHERE id NOT IN (SELECT id FROM auth.users);

    -- 2. Add Foreign Key to auth.users if not exists
    -- This ensures future deletions of auth.users will automatically cascade to profiles
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_id_fkey_auth' 
        AND table_name = 'profiles'
    ) THEN
        -- Check if there is an existing PK or FK on id that might conflict or we just add a new one.
        -- Usually 'profiles' has 'id' as PK. We can add a separate FK.
        
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_id_fkey_auth 
        FOREIGN KEY (id) 
        REFERENCES auth.users(id) 
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Added FK profiles -> auth.users with CASCADE';
    END IF;

END $$;
