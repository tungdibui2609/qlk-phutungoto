-- Add member_team_manager module to app_modules table
INSERT INTO public.app_modules (id, name, description, category, is_basic) VALUES
('member_team_manager', 'Thành viên & Đội', 'Quản lý nhân sự và các đội nhóm thi công, vận hành.', 'info', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_basic = EXCLUDED.is_basic;
