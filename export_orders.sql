-- Create export tasks table
CREATE TABLE public.export_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'Pending',
    notes TEXT,
    system_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create export task items table
CREATE TABLE public.export_task_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES public.export_tasks(id) ON DELETE CASCADE NOT NULL,
    lot_id UUID REFERENCES public.lots(id),
    position_id UUID REFERENCES public.positions(id),
    product_id UUID REFERENCES public.products(id),
    quantity DECIMAL NOT NULL,
    unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.export_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_task_items ENABLE ROW LEVEL SECURITY;

-- Broad Policy for Authenticated Users
CREATE POLICY "Enable all for authenticated users" ON public.export_tasks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable all for authenticated users items" ON public.export_task_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
