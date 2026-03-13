-- Add parent_id to categories for hierarchy
ALTER TABLE public.categories 
ADD COLUMN parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Add is_primary to product_category_rel
ALTER TABLE public.product_category_rel
ADD COLUMN is_primary BOOLEAN DEFAULT false;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_category_rel_is_primary ON public.product_category_rel(is_primary);

-- Comment for clarity
COMMENT ON COLUMN public.categories.parent_id IS 'ID của danh mục cha để tạo cấu trúc cây';
COMMENT ON COLUMN public.product_category_rel.is_primary IS 'Đánh dấu đây là danh mục chính của sản phẩm';
