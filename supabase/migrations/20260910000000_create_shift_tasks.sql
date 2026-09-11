-- Migration: Tạo module Sổ Giao Việc & Nhắc Nhở Bàn Giao (Shift Tasks & Handover Reminders)

CREATE TABLE IF NOT EXISTS public.shift_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL,
    system_code TEXT NOT NULL,
    company_id UUID,
    
    title TEXT NOT NULL,
    content TEXT,
    priority TEXT NOT NULL DEFAULT 'normal', -- 'urgent', 'important', 'normal'
    status TEXT NOT NULL DEFAULT 'pending',   -- 'pending' (Chờ tiếp nhận), 'in_progress' (Đang thực hiện), 'completed' (Hoàn thành), 'cancelled' (Đã hủy)
    
    -- Phân công ca / người nhận
    target_shift TEXT DEFAULT 'Ca tiếp theo', -- 'Ca 1', 'Ca 2', 'Ca 3', 'Toàn ca', 'Ca tiếp theo'
    target_shifts TEXT[] DEFAULT '{}',        -- Danh sách nhiều đội / ca cùng nhận việc
    assigned_to UUID,
    assigned_to_name TEXT,
    
    -- Đính kèm ảnh lúc tạo / giao việc dở dang
    images TEXT[] DEFAULT '{}',
    
    -- Người giao việc
    created_by UUID,
    created_by_name TEXT,
    
    -- Thông tin xác nhận tiếp nhận bàn giao
    acknowledged_by UUID,
    acknowledged_by_name TEXT,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledgements JSONB DEFAULT '[]'::jsonb, -- Danh sách những người đã xác nhận tiếp nhận
    edit_history JSONB DEFAULT '[]'::jsonb,     -- Lịch sử chỉnh sửa công việc
    
    -- Thông tin khi hoàn thành
    completed_by UUID,
    completed_by_name TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    completion_notes TEXT,
    completion_images TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bảng thảo luận / hỏi đáp làm rõ ghi chú
CREATE TABLE IF NOT EXISTS public.shift_task_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.shift_tasks(id) ON DELETE CASCADE,
    company_id UUID,
    user_id UUID,
    user_name TEXT,
    message TEXT NOT NULL,
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shift_tasks_system_code ON public.shift_tasks(system_code);
CREATE INDEX IF NOT EXISTS idx_shift_tasks_company_id ON public.shift_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_shift_tasks_status ON public.shift_tasks(status);
CREATE INDEX IF NOT EXISTS idx_shift_tasks_priority ON public.shift_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_shift_tasks_created_at ON public.shift_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_task_messages_task_id ON public.shift_task_messages(task_id);

-- Enable RLS
ALTER TABLE public.shift_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_task_messages ENABLE ROW LEVEL SECURITY;

-- Policies for shift_tasks
DROP POLICY IF EXISTS "Users can view shift_tasks in their company" ON public.shift_tasks;
CREATE POLICY "Users can view shift_tasks in their company" ON public.shift_tasks
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        ) OR company_id IS NULL
    );

DROP POLICY IF EXISTS "Users can insert shift_tasks" ON public.shift_tasks;
CREATE POLICY "Users can insert shift_tasks" ON public.shift_tasks
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        ) OR company_id IS NULL
    );

DROP POLICY IF EXISTS "Users can update shift_tasks" ON public.shift_tasks;
CREATE POLICY "Users can update shift_tasks" ON public.shift_tasks
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        ) OR company_id IS NULL
    );

DROP POLICY IF EXISTS "Users can delete shift_tasks" ON public.shift_tasks;
CREATE POLICY "Users can delete shift_tasks" ON public.shift_tasks
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        ) OR company_id IS NULL
    );

-- Policies for shift_task_messages
DROP POLICY IF EXISTS "Users can view shift_task_messages in their company" ON public.shift_task_messages;
CREATE POLICY "Users can view shift_task_messages in their company" ON public.shift_task_messages
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        ) OR company_id IS NULL
    );

DROP POLICY IF EXISTS "Users can insert shift_task_messages" ON public.shift_task_messages;
CREATE POLICY "Users can insert shift_task_messages" ON public.shift_task_messages
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        ) OR company_id IS NULL
    );

DROP POLICY IF EXISTS "Users can delete shift_task_messages" ON public.shift_task_messages;
CREATE POLICY "Users can delete shift_task_messages" ON public.shift_task_messages
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
        ) OR company_id IS NULL
    );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_shift_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_shift_tasks_updated_at ON public.shift_tasks;
CREATE TRIGGER set_shift_tasks_updated_at
    BEFORE UPDATE ON public.shift_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_shift_tasks_updated_at();

-- Enable Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'shift_tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_tasks;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'shift_task_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_task_messages;
    END IF;
END $$;

-- Register module into app_modules
INSERT INTO public.app_modules (id, name, description, category, is_basic)
VALUES (
    'shift_tasks',
    'Sổ Giao Việc & Nhắc Nhở Bàn Giao',
    'Giao việc dở dang, tạo nhắc nhở giao ca có đính kèm hình ảnh và xác nhận tiếp nhận 2 bên rõ ràng.',
    'utility',
    true
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_basic = EXCLUDED.is_basic;
