-- 1. Tạo bảng nếu chưa có
CREATE TABLE IF NOT EXISTS public.inventory_check_item_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id uuid NOT NULL REFERENCES public.inventory_check_items(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.user_profiles(id),
    user_name text,
    content text NOT NULL,
    actual_quantity numeric,
    system_quantity numeric,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    company_id uuid
);

-- 2. Thêm cột is_reviewer một cách an toàn (nếu chưa có)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory_check_item_logs' AND column_name='is_reviewer') THEN
        ALTER TABLE public.inventory_check_item_logs ADD COLUMN is_reviewer boolean DEFAULT false;
    END IF;
END $$;

-- 3. Tạo chỉ mục
CREATE INDEX IF NOT EXISTS idx_inv_check_item_logs_item_id ON public.inventory_check_item_logs(item_id);

-- 4. Kích hoạt RLS
ALTER TABLE public.inventory_check_item_logs ENABLE ROW LEVEL SECURITY;

-- 5. Cập nhật Policy an toàn (Xóa trước khi tạo lại để tránh lỗi "already exists")
DROP POLICY IF EXISTS "Users can view logs of their company" ON public.inventory_check_item_logs;
CREATE POLICY "Users can view logs of their company" ON public.inventory_check_item_logs
    FOR SELECT USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can insert logs for their company" ON public.inventory_check_item_logs;
CREATE POLICY "Users can insert logs for their company" ON public.inventory_check_item_logs
    FOR INSERT WITH CHECK (company_id = get_user_company_id());
