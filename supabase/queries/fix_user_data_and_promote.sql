-- =============================================================================
-- FIX DATA & PROMOTE TO SUPER ADMIN (FOR TESTING)
-- =============================================================================

DO $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
BEGIN
    -- 1. Get User ID
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'traicay@gmail.com';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User traicay@gmail.com not found!';
    END IF;

    -- 2. Ensure User has Company ID
    SELECT company_id INTO v_company_id FROM public.user_profiles WHERE id = v_user_id;
    
    IF v_company_id IS NULL THEN
        -- Create default company if missing
        INSERT INTO public.companies (name, code) 
        VALUES ('Hợp Tác Xã Trái Cây ABC', 'FARM') 
        RETURNING id INTO v_company_id;
        
        -- Assign to user
        UPDATE public.user_profiles SET company_id = v_company_id WHERE id = v_user_id;
        RAISE NOTICE 'Created new company and assigned to user.';
    END IF;

    -- 3. Ensure Company Settings Exist
    INSERT INTO public.company_settings (id, name, code, short_name, updated_at)
    VALUES (
        v_company_id, 
        'Hợp Tác Xã Trái Cây ABC', 
        'FARM', 
        'Hợp Tác Xã Trái Cây',
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET 
        updated_at = NOW(); -- Just to ensure it exists

    -- 4. PROMOTE TO LEVEL 1 (SUPER ADMIN) TEMPORARILY
    -- This helps us verify if the issue is strictly due to Level 2 permissions
    UPDATE public.user_profiles 
    SET account_level = 1, 
        permissions = array_append(permissions, 'system.full_access') 
    WHERE id = v_user_id;

    RAISE NOTICE 'User promoted to Level 1 and data fixed.';
END $$;
