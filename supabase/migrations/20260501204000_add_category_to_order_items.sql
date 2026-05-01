ALTER TABLE public.inbound_order_items ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.outbound_order_items ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
