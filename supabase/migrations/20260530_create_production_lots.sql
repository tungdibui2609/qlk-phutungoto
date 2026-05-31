-- =========================================================================
-- KHẨN CẤP: KHÔI PHỤC BẢNG HỆ THỐNG GỐC production_lots & TẠO BẢNG RIÊNG CHO SẢN XUẤT TỰ KHAI BÁO
-- =========================================================================

-- 1. Xóa bảng custom bị trùng tên (nếu có)
DROP TABLE IF EXISTS public.production_lots CASCADE;

-- 2. Tái tạo BẢNG HỆ THỐNG GỐC production_lots cùng các trường liên quan đến Lệnh sản xuất
CREATE TABLE public.production_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    production_id UUID REFERENCES public.productions(id) ON DELETE CASCADE NOT NULL,
    lot_code TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    weight_per_unit NUMERIC DEFAULT 0,
    planned_quantity DECIMAL DEFAULT NULL,
    conversion_rules JSONB DEFAULT '[]'::jsonb,
    last_printed_index INTEGER DEFAULT 0,
    total_printed_labels INTEGER DEFAULT 0,
    total_printed_sheets INTEGER DEFAULT 0,
    damaged_printed_labels INTEGER DEFAULT 0,
    damaged_printed_sheets INTEGER DEFAULT 0,
    damaged_print_logs JSONB DEFAULT '[]'::jsonb,
    last_printed_at TIMESTAMPTZ,
    print_config JSONB DEFAULT '{}'::jsonb
);

-- Thêm mô tả các cột gốc
COMMENT ON COLUMN public.production_lots.product_id IS 'Liên kết trực tiếp tới sản phẩm để tối ưu truy vấn in';
COMMENT ON COLUMN public.production_lots.last_printed_index IS 'STT tem cuối cùng đã in của lô này';
COMMENT ON COLUMN public.production_lots.damaged_print_logs IS 'Nhật ký in bù tem/tờ hỏng (lý do, user, số lượng)';
COMMENT ON COLUMN public.production_lots.total_printed_labels IS 'Tổng số tem đạt đã in';
COMMENT ON COLUMN public.production_lots.total_printed_sheets IS 'Tổng số tờ A4 đạt đã in';
COMMENT ON COLUMN public.production_lots.print_config IS 'Cấu hình in tùy chỉnh cho từng lô (quy cách, khối lượng...)';

-- Bật RLS và thêm các chính sách bảo mật gốc cho bảng production_lots
ALTER TABLE public.production_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view production_lots for their company" ON public.production_lots FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can insert production_lots for their company" ON public.production_lots FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update production_lots for their company" ON public.production_lots FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can delete production_lots for their company" ON public.production_lots FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid())
);

-- Thiết lập Replica realtime cho production_lots
ALTER TABLE public.production_lots REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'production_lots') THEN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_lots; END IF;
    END IF;
END $$;


-- 3. Tái tạo VIEW thống kê sản lượng gốc bị ảnh hưởng bởi CASCADE
CREATE OR REPLACE VIEW public.production_item_statistics AS
SELECT 
    pl.id as production_lot_id,
    pl.production_id,
    pl.product_id,
    pl.planned_quantity,
    COALESCE((
        SELECT SUM(li.quantity)
        FROM public.lots l
        JOIN public.lot_items li ON li.lot_id = l.id
        WHERE l.production_id = pl.production_id
          AND li.product_id = pl.product_id
    ), 0) as actual_quantity
FROM public.production_lots pl;

GRANT SELECT ON public.production_item_statistics TO authenticated;
GRANT SELECT ON public.production_item_statistics TO service_role;


-- 4. TẠO BẢNG RIÊNG BIỆT CHO TRANG SẢN XUẤT TỰ KHAI BÁO (Tránh xung đột hoàn toàn)
CREATE TABLE IF NOT EXISTS public.production_custom_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL,
    lot_type VARCHAR(50) NOT NULL, -- 'semi_finished' hoặc 'finished'
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'hidden' (xóa mềm)
    system_code VARCHAR(50) NOT NULL, -- Phân hệ kho cô lập dữ liệu
    company_id UUID, -- Bảo mật đa khách hàng
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tạo Index
CREATE INDEX IF NOT EXISTS idx_production_custom_lots_code ON public.production_custom_lots(code);
CREATE INDEX IF NOT EXISTS idx_production_custom_lots_lot_type ON public.production_custom_lots(lot_type);
CREATE INDEX IF NOT EXISTS idx_production_custom_lots_system_code ON public.production_custom_lots(system_code);

-- Enable RLS cho bảng mới
ALTER TABLE public.production_custom_lots ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách bảo mật cho bảng mới
CREATE POLICY "Allow authenticated users access to production_custom_lots" 
ON public.production_custom_lots
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
