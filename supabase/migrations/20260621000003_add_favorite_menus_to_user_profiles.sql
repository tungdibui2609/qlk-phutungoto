-- Add missing favorite_menus to user_profiles
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS favorite_menus JSONB DEFAULT '[]'::jsonb;
