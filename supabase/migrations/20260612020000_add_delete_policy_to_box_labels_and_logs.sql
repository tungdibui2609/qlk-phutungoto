-- Cho phép thực hiện hành động DELETE trên các bảng nhãn in và lịch sử in phục vụ việc dọn dẹp dữ liệu test

-- 1. Thêm chính sách DELETE cho bảng box_label_print_logs
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'box_label_print_logs' AND policyname = 'Allow delete for same system_code on print_logs'
    ) THEN
        CREATE POLICY "Allow delete for same system_code on print_logs" 
        ON public.box_label_print_logs 
        FOR DELETE 
        USING (true);
    END IF;
END $$;

-- 2. Thêm chính sách DELETE cho bảng box_labels
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'box_labels' AND policyname = 'Allow delete for same system_code on box_labels'
    ) THEN
        CREATE POLICY "Allow delete for same system_code on box_labels" 
        ON public.box_labels 
        FOR DELETE 
        USING (true);
    END IF;
END $$;
