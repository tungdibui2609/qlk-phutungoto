CREATE TABLE IF NOT EXISTS public.warehouse_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_type TEXT NOT NULL,
    company_id UUID,
    name TEXT NOT NULL,
    width INTEGER NOT NULL DEFAULT 20,
    height INTEGER NOT NULL DEFAULT 20,
    grid_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Bật RLS
ALTER TABLE public.warehouse_layouts ENABLE ROW LEVEL SECURITY;

-- Các chính sách RLS
CREATE POLICY "Cho phép tất cả thao tác trên warehouse_layouts" 
ON public.warehouse_layouts FOR ALL USING (true);
