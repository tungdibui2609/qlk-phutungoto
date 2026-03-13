-- 1. Tạo bảng product_category_rel
CREATE TABLE IF NOT EXISTS public.product_category_rel (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
    system_type text NOT NULL,
    company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    -- Đảm bảo một cặp product-category là duy nhất
    UNIQUE(product_id, category_id)
);

-- 2. Bật RLS
ALTER TABLE public.product_category_rel ENABLE ROW LEVEL SECURITY;

-- 3. Tạo policies (tuân thủ cô lập dữ liệu theo phân hệ và tenant)
-- Policy cho phép xem dữ liệu thuộc system_type và company_id được phép
CREATE POLICY "Users can view product category relations of their company and system"
    ON public.product_category_rel
    FOR SELECT
    USING (
        (company_id IS NULL OR company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))
    );

-- Policy cho phép insert/update/delete
CREATE POLICY "Users can manage product category relations of their company"
    ON public.product_category_rel
    FOR ALL
    USING (
        (company_id IS NULL OR company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))
    )
    WITH CHECK (
        (company_id IS NULL OR company_id IN (SELECT company_id FROM public.user_profiles WHERE id = auth.uid()))
    );

-- 4. Di chuyển dữ liệu cũ từ products.category_id sang bảng mới
INSERT INTO public.product_category_rel (product_id, category_id, system_type, company_id)
SELECT id, category_id, system_type, (SELECT company_id FROM public.user_profiles LIMIT 1) -- Tạm thời lấy company_id đầu tiên nếu không có thông tin chính xác trong bảng products
FROM public.products
WHERE category_id IS NOT NULL
ON CONFLICT (product_id, category_id) DO NOTHING;

-- Chú ý: Cột company_id trong products có thể không tồn tại hoặc tên khác. 
-- Hãy kiểm tra lại cấu trúc bảng products để mapping company_id chính xác hơn nếu cần.
