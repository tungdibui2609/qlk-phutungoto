-- Create print_queue table for remote printing
CREATE TABLE IF NOT EXISTS public.print_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    lot_id UUID REFERENCES public.lots(id) ON DELETE CASCADE,
    lot_code TEXT NOT NULL,
    print_data JSONB NOT NULL, -- Contains products, tags, dates, etc.
    status TEXT DEFAULT 'pending' NOT NULL, -- pending, processing, completed, failed
    error_message TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    system_id UUID REFERENCES public.systems(id) ON DELETE CASCADE,
    printer_id TEXT, -- Optional: targeting a specific printer
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.print_queue ENABLE ROW LEVEL SECURITY;

-- Policies for print_queue
CREATE POLICY "Users can insert print jobs for their company"
ON public.print_queue
FOR INSERT
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can view print jobs for their company"
ON public.print_queue
FOR SELECT
USING (
    company_id IN (
        SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can update print jobs for their company"
ON public.print_queue
FOR UPDATE
USING (
    company_id IN (
        SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    )
);

-- Enable Realtime for print_queue
ALTER TABLE public.print_queue REPLICA IDENTITY FULL;
-- Add to realtime publication if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.print_queue;
    END IF;
END $$;
