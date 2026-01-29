SELECT u.email, u.company_id, c.name as company_name, cs.id as settings_id 
FROM user_profiles u 
LEFT JOIN companies c ON u.company_id = c.id 
LEFT JOIN company_settings cs ON u.company_id = cs.id 
WHERE u.email = 'traicay@gmail.com';
