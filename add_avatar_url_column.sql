-- Add avatar_url column to user_profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'user_profiles'
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE user_profiles
        ADD COLUMN avatar_url text;
    END IF;
END
$$;

-- Allow users to update their own profile (if RLS is enabled)
-- Note: You might already have policies, this is just to ensure update is possible
-- CREATE POLICY "Users can update their own profile"
-- ON user_profiles FOR UPDATE
-- USING (auth.uid() = id);
