SELECT * FROM public.systems;
SELECT * FROM public.user_systems WHERE user_id IN ('6306ecf2-22ad-4d25-8986-91831c14fe27', '1d502b01-df8b-4f27-9965-fa550a5b4096');
SELECT u.email, r.name as role_name, r.code as role_code 
FROM public.user_profiles u 
JOIN public.roles r ON u.role_id = r.id 
WHERE u.id IN ('6306ecf2-22ad-4d25-8986-91831c14fe27', '1d502b01-df8b-4f27-9965-fa550a5b4096');
