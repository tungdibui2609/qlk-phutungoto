CREATE TABLE IF NOT EXISTS public.zone_status_layouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_code TEXT,
    company_id UUID,
    zone_id UUID,
    layout_data JSONB DEFAULT '{}'::jsonb,
    use_full_title BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.zone_status_layouts 
ADD COLUMN IF NOT EXISTS use_full_title BOOLEAN DEFAULT false;

-- Update the comment for documentation (optional but good practice)
COMMENT ON COLUMN zone_status_layouts.use_full_title IS 'If true, display the full zone name in grouped view instead of code/short name.';
