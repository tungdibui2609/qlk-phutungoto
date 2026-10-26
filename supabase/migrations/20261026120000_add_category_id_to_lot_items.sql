-- Cho phép mỗi dòng sản phẩm trong LOT mang danh mục riêng, độc lập với danh mục khai báo trên sản phẩm
ALTER TABLE public.lot_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lot_items_category_id ON public.lot_items USING btree (category_id);
