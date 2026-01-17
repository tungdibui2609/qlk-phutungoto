-- Create zone_templates table
CREATE TABLE IF NOT EXISTS zone_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    structure JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS for simplicity (internal app)
ALTER TABLE zone_templates DISABLE ROW LEVEL SECURITY;
