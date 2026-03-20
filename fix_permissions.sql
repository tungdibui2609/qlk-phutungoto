-- 1. Create user_systems if it really doesn't exist
CREATE TABLE IF NOT EXISTS public.user_systems (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    system_id uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, system_id)
);

-- 2. Link the users to ALL systems
-- Nguyễn Đình Tùng (6306ecf2-22ad-4d25-8986-91831c14fe27)
INSERT INTO public.user_systems (user_id, system_id)
SELECT '6306ecf2-22ad-4d25-8986-91831c14fe27', id FROM public.systems
ON CONFLICT DO NOTHING;

-- Super Admin (1d502b01-df8b-4f27-9965-fa550a5b4096)
INSERT INTO public.user_systems (user_id, system_id)
SELECT '1d502b01-df8b-4f27-9965-fa550a5b4096', id FROM public.systems
ON CONFLICT DO NOTHING;

-- 3. Ensure they have the right roles (Find the super_admin role ID first)
DO $$
DECLARE
    role_id_var uuid;
BEGIN
    SELECT id INTO role_id_var FROM public.roles WHERE code = 'super_admin' LIMIT 1;
    
    IF role_id_var IS NOT NULL THEN
        UPDATE public.user_profiles SET role_id = role_id_var WHERE id = '1d502b01-df8b-4f27-9965-fa550a5b4096';
    END IF;
    
    -- Also make Tùng an admin if roles exist
    SELECT id INTO role_id_var FROM public.roles WHERE code = 'admin' LIMIT 1;
    IF role_id_var IS NOT NULL THEN
        UPDATE public.user_profiles SET role_id = role_id_var WHERE id = '6306ecf2-22ad-4d25-8986-91831c14fe27';
    END IF;
END $$;
