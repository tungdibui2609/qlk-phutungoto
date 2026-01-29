-- =============================================================================
-- REVERT USER TO COMPANY ADMIN (LEVEL 2)
-- =============================================================================

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'traicay@gmail.com';
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User not found';
        RETURN;
    END IF;

    -- Set back to Level 2
    UPDATE public.user_profiles 
    SET account_level = 2,
        -- Remove 'system.full_access' permission if it was added
        permissions = array_remove(permissions, 'system.full_access')
    WHERE id = v_user_id;

    RAISE NOTICE 'User reverted to Level 2 (Company Admin).';
END $$;
