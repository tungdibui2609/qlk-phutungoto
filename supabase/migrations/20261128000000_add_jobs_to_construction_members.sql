-- Thêm cột công việc chính (main_job) và việc phụ (sub_job) cho bảng construction_members
ALTER TABLE public.construction_members
    ADD COLUMN IF NOT EXISTS main_job text,
    ADD COLUMN IF NOT EXISTS sub_job text;

COMMENT ON COLUMN public.construction_members.main_job IS 'Công việc chính của thành viên';
COMMENT ON COLUMN public.construction_members.sub_job IS 'Việc phụ / công việc hỗ trợ của thành viên';
